$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$request = $null
function Cut-Text($Value, [int]$Limit = 12000) {
    $text = [string]$Value
    if ($text.Length -gt $Limit) { return $text.Substring(0, $Limit) }
    return $text
}
function Get-MailSummary($item) {
    return @{ id = [string]$item.EntryID; storeId = [string]$item.Parent.StoreID; modified = $item.LastModificationTime.ToUniversalTime().ToString('o'); subject = Cut-Text $item.Subject 1000; sender = [string]$item.SenderName; senderAddress = [string]$item.SenderEmailAddress; received = $item.ReceivedTime.ToUniversalTime().ToString('o'); unread = [bool]$item.UnRead; isDraft = (-not [bool]$item.Sent); categories = [string]$item.Categories; flagStatus = [int]$item.FlagStatus; folder = [string]$item.Parent.Name }
}
function Get-Folder($taskArgs) {
    if ($taskArgs.id -and $taskArgs.storeId) { return $session.GetFolderFromID([string]$taskArgs.id, [string]$taskArgs.storeId) }
    return $session.GetDefaultFolder(6)
}
function Get-Item($taskArgs) {
    if (-not $taskArgs.id -or -not $taskArgs.storeId) { throw 'E-posta kimligi gerekli.' }
    return $session.GetItemFromID([string]$taskArgs.id, [string]$taskArgs.storeId)
}
function Check-Snapshot($item, $taskArgs) {
    if ($taskArgs.expectedModified -and $item.LastModificationTime.ToUniversalTime().ToString('o') -ne $taskArgs.expectedModified) { throw 'Oge degisti. Yeniden inceleyip yeni islem hazirlayin.' }
}
function List-Folders($folder, [int]$depth = 0) {
    if ($depth -gt 8 -or $script:folderRows.Count -ge 250) { $script:folderTruncated = $true; return }
    if ($folder.DefaultItemType -eq 0) { $script:folderRows.Add(@{ id = [string]$folder.EntryID; storeId = [string]$folder.StoreID; name = [string]$folder.Name; path = [string]$folder.FolderPath; count = [int]$folder.Items.Count; unread = [int]$folder.UnReadItemCount }) }
    for ($folderIndex = 1; $folderIndex -le $folder.Folders.Count; $folderIndex++) { List-Folders ($folder.Folders.Item($folderIndex)) ($depth + 1) }
}
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $taskArgs = $request.args
    $profileRoots = @('HKCU:\Software\Microsoft\Office\16.0\Outlook\Profiles', 'HKCU:\Software\Microsoft\Office\15.0\Outlook\Profiles')
    $hasProfile = $false
    foreach ($profileRoot in $profileRoots) { if ((Test-Path -LiteralPath $profileRoot) -and @(Get-ChildItem -LiteralPath $profileRoot).Count -gt 0) { $hasProfile = $true } }
    if (-not $hasProfile) { throw 'Klasik Outlook profiliniz yok. Klasik Outlook uygulamasini acip hesabinizi ekleyin.' }
    try { $outlook = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application') }
    catch { throw 'Klasik Outlook acik degil. OUTLOOK.EXE uygulamasini acip posta kutusunun yuklenmesini bekleyin.' }
    $session = $outlook.GetNamespace('MAPI')
    if ($session.Stores.Count -lt 1) { throw 'Outlook posta kutusu henuz yuklenmedi.' }
    $result = $null
    switch ([string]$request.op) {
        'status' { $result = @{ connected = $true; stores = [int]$session.Stores.Count; profile = 'Klasik Outlook'; defaultStoreId = [string]$session.DefaultStore.StoreID } }
        'list_folders' {
            $script:folderRows = New-Object 'Collections.Generic.List[object]'; $script:folderTruncated = $false
            for ($storeIndex = 1; $storeIndex -le $session.Stores.Count; $storeIndex++) { List-Folders ($session.Stores.Item($storeIndex).GetRootFolder()) }
            $result = @{ folders = @($script:folderRows.ToArray()); truncated = $script:folderTruncated }
        }
        'list_messages' {
            $folder = Get-Folder $taskArgs
            $items = $folder.Items
            $items.Sort('[ReceivedTime]', $true)
            $limit = [Math]::Min(100, [Math]::Max(1, [int]$taskArgs.limit)); if (-not $taskArgs.limit) { $limit = 30 }
            $offset = [Math]::Max(0, [int]$taskArgs.offset)
            $rows = New-Object 'Collections.Generic.List[object]'
            $seen = 0; $scanned = 0; $total = $items.Count
            for ($itemIndex = 1; $itemIndex -le $total -and $scanned -lt 10000; $itemIndex++) {
                $scanned++; $item = $items.Item($itemIndex)
                if ($item.Class -ne 43) { continue }
                if ($taskArgs.unreadOnly -and -not $item.UnRead) { continue }
                if ($taskArgs.since -and $item.ReceivedTime.ToUniversalTime() -lt [DateTime]::Parse($taskArgs.since).ToUniversalTime()) { break }
                if ($seen++ -lt $offset) { continue }
                $rows.Add((Get-MailSummary $item))
                if ($rows.Count -ge $limit) { break }
            }
            $result = @{ messages = @($rows.ToArray()); scanned = $scanned; folderTotal = $total; offset = $offset; nextOffset = $offset + $rows.Count; hasMore = ($itemIndex -lt $total); scanLimitReached = ($scanned -ge 10000) }
        }
        'get_message' {
            $item = Get-Item $taskArgs
            if ($item.Class -ne 43) { throw 'Secilen oge bir e-posta degil.' }
            $result = Get-MailSummary $item
            $result.body = Cut-Text $item.Body 40000
            $result.bodyTruncated = ([string]$item.Body).Length -gt 40000
            $result.to = [string]$item.To; $result.cc = [string]$item.CC
            $result.bcc = [string]$item.BCC
            $result.recipients = @(); foreach ($recipient in $item.Recipients) { $result.recipients += @{ name = [string]$recipient.Name; address = [string]$recipient.Address; type = [int]$recipient.Type } }
            $result.sendingAccount = 'Outlook varsayilan hesabi'; if ($null -ne $item.SendUsingAccount) { $result.sendingAccount = [string]$item.SendUsingAccount.SmtpAddress }
            $result.attachments = @(); for ($attachmentIndex = 1; $attachmentIndex -le $item.Attachments.Count; $attachmentIndex++) { $attachment = $item.Attachments.Item($attachmentIndex); $result.attachments += @{ index = $attachmentIndex; name = [string]$attachment.FileName; size = [int]$attachment.Size } }
        }
        'search_messages' {
            $query = [string]$taskArgs.query
            if ($query.Length -lt 1 -or $query.Length -gt 200) { throw 'Arama metni 1-200 karakter olmali.' }
            $limit = [Math]::Min(100, [Math]::Max(1, [int]$taskArgs.limit)); if (-not $taskArgs.limit) { $limit = 30 }
            $rows = New-Object 'Collections.Generic.List[object]'; $searched = 0; $scanLimit = 10000; $folderCount = 0; $limited = $false; $bodyLimited = $false
            if ($taskArgs.id) { $targets = @((Get-Folder $taskArgs)) } else {
                $script:folderRows = New-Object 'Collections.Generic.List[object]'; $script:folderTruncated = $false
                for ($storeIndex = 1; $storeIndex -le $session.Stores.Count; $storeIndex++) { List-Folders ($session.Stores.Item($storeIndex).GetRootFolder()) }
                $targets = @($script:folderRows.ToArray() | ForEach-Object { $session.GetFolderFromID($_.id, $_.storeId) })
                $limited = $script:folderTruncated
            }
            foreach ($folder in $targets) {
                $folderCount++; $items = $folder.Items; $items.Sort('[ReceivedTime]', $true)
                for ($itemIndex = 1; $itemIndex -le $items.Count; $itemIndex++) {
                    if ($searched -ge $scanLimit -or $rows.Count -ge $limit) { $limited = $true; break }
                    $searched++; $item = $items.Item($itemIndex); if ($item.Class -ne 43) { continue }
                    if ($taskArgs.since -and $item.ReceivedTime.ToUniversalTime() -lt [DateTime]::Parse($taskArgs.since).ToUniversalTime()) { break }
                    if ($taskArgs.unreadOnly -and -not $item.UnRead) { continue }
                    $haystack = [string]$item.Subject + ' ' + [string]$item.SenderName + ' ' + [string]$item.SenderEmailAddress
                    if ($taskArgs.includeBody) { $mailBody = [string]$item.Body; if ($mailBody.Length -gt 20000) { $bodyLimited = $true }; $haystack += ' ' + (Cut-Text $mailBody 20000) }
                    if ($haystack.IndexOf($query, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $rows.Add((Get-MailSummary $item)) }
                }
                if ($searched -ge $scanLimit -or $rows.Count -ge $limit) { break }
            }
            $result = @{ messages = @($rows.ToArray()); scanned = $searched; foldersScanned = $folderCount; truncated = ($limited -or $bodyLimited); bodyTruncationEncountered = $bodyLimited; scanLimit = $scanLimit }
        }
        'read_text_attachment' {
            $item = Get-Item $taskArgs; $attachment = $item.Attachments.Item([int]$taskArgs.index)
            $extension = [IO.Path]::GetExtension([string]$attachment.FileName).ToLowerInvariant()
            if ($extension -notin @('.txt','.csv','.md','.json','.log','.ics') -or $attachment.Size -gt 1048576) { throw 'Yalnizca 1 MB altindaki metin ekleri okunabilir. PDF/Office ekleri bu surumde cozumlenmez.' }
            $temporaryPath = Join-Path $env:TEMP ('outlook-agent-' + [Guid]::NewGuid().ToString('N') + '.txt')
            try { $attachment.SaveAsFile($temporaryPath); $content = [IO.File]::ReadAllText($temporaryPath); $result = @{ name = [string]$attachment.FileName; text = Cut-Text $content 40000; truncated = $content.Length -gt 40000 } }
            finally { if (Test-Path -LiteralPath $temporaryPath) { Remove-Item -LiteralPath $temporaryPath } }
        }
        'list_calendar' {
            $start = [DateTime]::Parse($taskArgs.start); $end = [DateTime]::Parse($taskArgs.end)
            if ($end -le $start -or ($end - $start).TotalDays -gt 366) { throw 'Takvim araligi 1-366 gun olmali.' }
            $items = $session.GetDefaultFolder(9).Items; $items.Sort('[Start]'); $items.IncludeRecurrences = $true
            $culture = [Globalization.CultureInfo]::GetCultureInfo('en-US')
            $filter = "[Start] < '" + $end.ToString('g',$culture) + "' AND [End] > '" + $start.ToString('g',$culture) + "'"
            $filtered = $items.Restrict($filter); $rows = @(); $item = $filtered.GetFirst()
            while ($null -ne $item -and $rows.Count -lt 200) { $rows += @{ id = [string]$item.EntryID; storeId = [string]$item.Parent.StoreID; subject = [string]$item.Subject; start = $item.Start.ToString('o'); end = $item.End.ToString('o'); location = [string]$item.Location }; $item = $filtered.GetNext() }
            $result = @{ events = $rows; truncated = ($null -ne $item); timezone = [TimeZoneInfo]::Local.Id }
        }
        'list_tasks' {
            $items = $session.GetDefaultFolder(13).Items; $rows = @()
            for ($itemIndex = 1; $itemIndex -le $items.Count -and $rows.Count -lt 200; $itemIndex++) { $item = $items.Item($itemIndex); if ($item.Class -ne 48) { continue }; $rows += @{ id = [string]$item.EntryID; storeId = [string]$item.Parent.StoreID; subject = [string]$item.Subject; due = $item.DueDate.ToString('o'); complete = [bool]$item.Complete; modified = $item.LastModificationTime.ToUniversalTime().ToString('o') } }
            $result = @{ tasks = $rows; truncated = $items.Count -gt 200 }
        }
        'apply' {
            # This entry point is called only by the local web server after the user approves the exact staged operation.
            $operation = [string]$taskArgs.action
            $item = $null
            if ($taskArgs.id) { $item = Get-Item $taskArgs; Check-Snapshot $item $taskArgs }
            switch ($operation) {
                'mark_read' { $item.UnRead = (-not [bool]$taskArgs.read); $item.Save(); $result = @{ applied = $true } }
                'set_flag' { $item.FlagStatus = [int]$taskArgs.flagStatus; $item.Save(); $result = @{ applied = $true } }
                'set_categories' { $item.Categories = [string]$taskArgs.categories; $item.Save(); $result = @{ applied = $true } }
                'move_message' { $destination = $session.GetFolderFromID([string]$taskArgs.destinationId, [string]$taskArgs.destinationStoreId); if ($destination.DefaultItemType -ne 0) { throw 'Hedef bir posta klasoru olmali.' }; $moved = $item.Move($destination); $result = Get-MailSummary $moved }
                'delete_message' { if ($item.Parent.EntryID -eq $session.GetDefaultFolder(3).EntryID) { throw 'Kalici silme desteklenmiyor.' }; $deletedFolder = $item.Parent.Store.GetDefaultFolder(3); $moved = $item.Move($deletedFolder); $result = @{ applied = $true; destination = [string]$deletedFolder.Name } }
                'create_folder' { $parent = $session.GetFolderFromID([string]$taskArgs.parentId, [string]$taskArgs.parentStoreId); $folder = $parent.Folders.Add([string]$taskArgs.name, 6); $result = @{ id = [string]$folder.EntryID; storeId = [string]$folder.StoreID; name = [string]$folder.Name } }
                'create_draft' { $draft = $session.GetDefaultFolder(16).Items.Add('IPM.Note'); $draft.To = [string]$taskArgs.to; $draft.CC = [string]$taskArgs.cc; $draft.Subject = [string]$taskArgs.subject; $draft.Body = [string]$taskArgs.body; $draft.Save(); $result = Get-MailSummary $draft }
                'reply' { $draft = $item.Reply(); $draft.Body = [string]$taskArgs.body + "`r`n`r`n" + [string]$draft.Body; $draft.Save(); $result = Get-MailSummary $draft }
                'reply_all' { $draft = $item.ReplyAll(); $draft.Body = [string]$taskArgs.body + "`r`n`r`n" + [string]$draft.Body; $draft.Save(); $result = Get-MailSummary $draft }
                'forward' { $draft = $item.Forward(); $draft.To = [string]$taskArgs.to; $draft.CC = [string]$taskArgs.cc; $draft.Body = [string]$taskArgs.body + "`r`n`r`n" + [string]$draft.Body; $draft.Save(); $result = Get-MailSummary $draft }
                'send_draft' { if ($item.Sent -or $item.Parent.EntryID -ne $item.Parent.Store.GetDefaultFolder(16).EntryID) { throw 'Yalnizca Taslaklar klasorundeki gonderilmemis posta gonderilebilir.' }; if (-not $item.Recipients.ResolveAll()) { throw 'Alici adresleri cozumlenemedi.' }; $item.Send(); $result = @{ submitted = $true; deliveryConfirmed = $false } }
                'create_event' { $start = [DateTime]::Parse($taskArgs.start); $end = [DateTime]::Parse($taskArgs.end); if ($end -le $start) { throw 'Bitis baslangictan sonra olmali.' }; $event = $session.GetDefaultFolder(9).Items.Add('IPM.Appointment'); $event.Subject = [string]$taskArgs.subject; $event.Body = [string]$taskArgs.body; $event.Location = [string]$taskArgs.location; $event.Start = $start; $event.End = $end; $event.Save(); $result = @{ applied = $true; id = [string]$event.EntryID; meetingInvitationsSent = $false } }
                'create_task' { $task = $session.GetDefaultFolder(13).Items.Add('IPM.Task'); $task.Subject = [string]$taskArgs.subject; $task.Body = [string]$taskArgs.body; if ($taskArgs.due) { $task.DueDate = [DateTime]::Parse($taskArgs.due) }; $task.Save(); $result = @{ applied = $true; id = [string]$task.EntryID } }
                'complete_task' { if ($item.Class -ne 48) { throw 'Secilen oge bir gorev degil.' }; $item.MarkComplete(); $item.Save(); $result = @{ applied = $true } }
                default { throw 'Desteklenmeyen islem.' }
            }
        }
        default { throw 'Desteklenmeyen okuma islemi.' }
    }
    [Console]::Write((@{ ok = $true; result = $result } | ConvertTo-Json -Depth 15 -Compress))
} catch {
    $message = $_.Exception.Message
    # Structured errors only; never print mail bodies or executable commands.
    [Console]::Write((@{ ok = $false; error = $message } | ConvertTo-Json -Depth 4 -Compress)); exit 1
}
