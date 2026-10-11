# Claude Tek Mail — Windows kurulum paketi

Outlook içinde açılan bir panel, bilgisayardaki **resmî ve değiştirilmemiş Claude Code CLI** uygulamasını çağırır. Kullanıcı Claude Code'a kendi Claude Pro/Max aboneliğiyle giriş yapar. API anahtarı gerekmez. İstekler abonelik kullanım limitlerini tüketir. Claude Desktop'ın Chat sekmesini otomatik kontrol etmez.

**Bu sürüm:** Önceki tek mail paneli; gelen kutusunu topluca taramaz. Düz metin kurulum: `KURULUM.txt`. Posta kutusu ajanı ayrı ZIP içindedir.

**Başlangıç:** `KURULUM-TR.html` dosyasını çift tıklayıp adımları izleyin.

## Gerekenler

- Windows 10/11, Node.js 22 veya üstü, Git for Windows ve güncel Claude Code. Kurulum betiği eksik olanları winget üzerinden kurar; bazı yükleyiciler Windows yönetici onayı isteyebilir.
- Kullanıcının Claude Code'da kullanabildiği Claude Pro/Max hesabı ve internet bağlantısı. Desktop'a giriş yapmak tek başına CLI girişinin yerine geçmez.
- Office web eklentilerini destekleyen Outlook sürümü ve posta hesabı; Outlook web, yeni veya klasik Outlook için XML dosyasından yükleme. Kurumda özel eklenti yükleme izni gerekebilir.
- HTTPS için bu Windows kullanıcısının sertifika deposuna localhost sertifikası eklenebilmesi.

## Kurulum sırası

1. ZIP dosyasını tamamen çıkarın. Klasörü yerel diskte kalıcı bir konuma koyun; ZIP içinden çalıştırmayın.
2. `1-KURULUM.cmd`: bağımlılık kontrolü, localhost sertifikası ve yerel yapılandırma.
3. `2-CLAUDE-GIRIS.cmd`: Anthropic'in kendi tarayıcı ekranında abonelik hesabına giriş. API/Console hesabı seçmeyin.
4. `3-BASLAT.cmd`: yerel HTTPS sunucusunu başlatır. Pencere açık kalmalı.
5. Tarayıcıda <https://localhost:3443> açın. Sertifika uyarısı olmamalı. Önce elle yazılmış örnek metinle taslak üretimini deneyin.
6. <https://aka.ms/olksideload> adresini Outlook posta hesabınızla açın. **My add-ins → Custom Addins → Add a custom add-in → Add from File** yolundan paketteki `manifest.xml` dosyasını yükleyin. XML seçeneği yeni uygulama mağazasından farklı bir diyalogdadır.
7. Outlook'u yenileyin; bir e-posta açın. **Asistanı Aç** düğmesini uygulamalar menüsünde veya şeritte bulun. Klasik Outlook önbelleği nedeniyle görünmesi 24 saate kadar sürebilir.
8. Panelde **Açık e-postayı getir** düğmesine basın, isteğinizi yazıp **Claude'a gönder** seçin. Sonucu kontrol edip **Outlook yanıtına ekle** veya **Kopyala** seçin. Gönder düğmesine siz basarsınız.

## Günlük kullanım

`3-BASLAT.cmd` dosyasını çalıştırıp pencereyi açık tutun; Outlook panelini kullanın. Otomatik başlangıç veya arka plan hizmeti kurulmaz. Durdurmak için sunucu penceresinde Ctrl+C kullanın. Her istek bağımsızdır; önceki yanıtlar sonraki isteğe otomatik eklenmez. Salt okunur e-postada cevap penceresi açılır, yazma modunda metin imleç konumuna eklenir.

## Kapsam ve veriler

- Konu, e-posta metni ve kullanıcının isteği yerel köprüden Claude Code'a, oradan Anthropic hizmetine gider. “Yerel” ifadesi bağlantı servisinin yerel olduğunu belirtir; model çevrimdışı çalışmaz.
- Ekler, tüm gelen kutusu ve takvim okunmaz. Panelden otomatik mail gönderme/silme yoktur. Eklenti yalnız açık öğenin metniyle çalışır; `ReadWriteItem` izni metin eklemek içindir.
- CLI için yerleşik araçlar ve MCP araçları kapatılır, kullanıcı özelleştirmeleri safe mode ile devre dışı bırakılır. Kurumsal yönetilen politikalar yine uygulanabilir.
- Paket posta içeriğini kendi log dosyasına yazmaz. CLI oturum dosyası kaydı kapatılır. Anthropic tarafındaki veri işleme hesabınızın politikasına tabidir.
- Oturum belirteçleri veya şifreler bu pakete kopyalanmaz. Her kullanıcı kendi değiştirilmemiş Claude Code uygulamasında kendi hesabına giriş yapar. Paket API/Console ve bulut sağlayıcısı oturumlarını reddeder; mevcut API ortam ayarlarını yalnız alt işlem ortamından çıkarır, sistem ayarlarını değiştirmez.
- `.local/` klasöründeki sertifika ve ayarlar o bilgisayara özeldir. Bu klasörü paylaşmayın. Dağıtılan ZIP içinde bu dosyalar yoktur.

## Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| 1-KURULUM tamamlanmıyor | Rehberdeki elle kurulumu izleyin. Kurumsal yazılım/sertifika kısıtlarını BT ile kontrol edin. |
| Claude bulunamadı / Git Bash hatası | Güncel Claude Code ve Git for Windows kurun, terminali yeniden açın. `4-TANI.cmd` çalıştırın. |
| API/Console oturumu uyarısı | `2-CLAUDE-GIRIS.cmd` dosyasını tekrar çalıştırıp abonelik hesabınızı seçin. Gerekirse kendi terminalinizde `claude auth logout`, sonra `claude auth login` kullanın. |
| Tanı başarılı, üretim başarısız | `claude update` ile CLI'ı güncelleyin. Winget kurulumu için `winget upgrade --id Anthropic.ClaudeCode --exact` kullanın. `claude -p "Sadece tamam yaz" --output-format json --tools "" --disallowedTools "mcp__*" --no-session-persistence` ile kişisel terminalde deneyin; bu deneme de abonelik kotasını kullanır. Desteklenmeyen bayrak için sürüm güncelleyin. |
| localhost açılmıyor | `3-BASLAT.cmd` penceresini ve 3443 portunu kontrol edin. Yalnız `https://localhost:3443` kullanın; IP adresini kullanmayın. |
| Sertifika uyarısı | Tarayıcı uyarısını atlamayın; `1-KURULUM.cmd` dosyasını tekrar çalıştırın. Kurum sertifika eklenmesini engelliyorsa BT desteği gerekir. |
| Panel boş / yerel ağ izni | Önce normal tarayıcıda localhost'u açın. Outlook veya tarayıcı yerel ağ erişimi sorarsa bu localhost eklentisi için izin verin. WebView2/Outlook'u güncelleyin. Kurum bunu engelliyorsa BT'ye başvurun. |
| Özel eklenti yükleme seçeneği yok | `aka.ms/olksideload` diyalogunu deneyin. Kurum özel eklentileri kapattıysa izin gerekir; bu paket o kısıtlamayı aşmaz. |
| “Claude aboneliği bağlı”, fakat kullanım limiti hatası | Abonelik limitinizin yenilenmesini bekleyin ve Claude hesabında plan durumunu kontrol edin. |
| E-posta okuma / yanıta ekleme çalışmıyor | Outlook içinde e-posta açılmış olmalı; tarayıcı önizlemesi Office bağlamı sağlamaz. Elle yapıştırma ve Kopyala kullanılabilir. |

## Elle bağımlılık kurulumu

PowerShell'de şu komutları çalıştırın, terminali kapatıp yeniden açın, sonra `1-KURULUM.cmd` dosyasını tekrar çalıştırın:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Git.Git --exact
winget install --id Anthropic.ClaudeCode --exact
```

Winget yoksa Microsoft **App Installer** uygulamasını kurun veya [Node.js LTS](https://nodejs.org/en/download), [Git for Windows](https://git-scm.com/downloads/win) ve [Claude Code resmî kurulum rehberini](https://code.claude.com/docs/en/setup) kullanın. Bu paket yalnız native `claude.exe` kurulumunu kullanır; npm `claude.cmd` sarmalayıcısını çağırmaz.

## Kaldırma

Sunucu penceresini kapatın. Outlook'ta eklentiyi kaldırın. `5-SERTIFIKAYI-KALDIR.cmd` yalnız paketin kendi localhost sertifikasını kullanıcı deposundan kaldırır. Ardından klasörü elle silebilirsiniz. Node.js, Git ve Claude Code kaldırılmaz; bunlar başka işlerinizde kullanılabilir.

## Doğrulama

Bu dağıtımın test sonuçları `DOGRULAMA.md` içindedir. Gerçek Claude aboneliği ve hedef Outlook sürümüyle uçtan uca deneme, kullanıcı bilgisayarında yapılmalıdır. Yeni bir bilgisayara yalnız dağıtım ZIP'ini taşıyın, `.local/` klasörünü taşımayın.

## Geliştirici

Haricî npm çalışma bağımlılığı yoktur. `node server.mjs` yerel sunucuyu çalıştırır; önce kurulumdaki sertifika ve yapılandırma gerekir. `npm.cmd test` bağlantı ve CLI köprüsü testlerini, `npm.cmd run check` sözdizimi kontrollerini çalıştırır. Office manifestini Microsoft'un `office-addin-manifest` aracıyla doğrulayabilirsiniz.

## Kaynaklar

- [Claude Code abonelikle giriş](https://code.claude.com/docs/en/authentication)
- [Claude Code'u programdan çalıştırma](https://code.claude.com/docs/en/headless)
- [CLI seçenekleri](https://code.claude.com/docs/en/cli-reference)
- [Claude Code kimlik bilgileri ve ürün entegrasyonu koşulları](https://code.claude.com/docs/en/legal-and-compliance)
- [Outlook XML eklentisini dosyadan yükleme](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing)

Hazırlanma tarihi: 11 Ekim 2026. Kişisel kullanım için hazırlanmış prototip; üçüncü taraflara Claude oturumu sağlayan bir servis içermez.
