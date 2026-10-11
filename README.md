# Outlook + Claude

Windows için iki ayrı kişisel kullanım prototipi: açık maille çalışan Outlook paneli ve klasik Outlook posta kutusuyla çalışan ajan. Resmî Microsoft/Anthropic eklentisi değildir.

## İndir ve kur

**[İki sürümü birlikte indir — Outlook-Claude-Iki-Surum.zip](https://github.com/YagizBerkutay/outlook-claude/releases/download/v1.0.0/Outlook-Claude-Iki-Surum.zip)**

Ayrı paketler: [Tek mail paneli](https://github.com/YagizBerkutay/outlook-claude/releases/download/v1.0.0/1-Claude-Tek-Mail.zip) · [Posta kutusu ajanı](https://github.com/YagizBerkutay/outlook-claude/releases/download/v1.0.0/2-Claude-Posta-Kutusu-Ajani.zip)

ZIP'i tamamen çıkarın, kullanacağınız paketin **KURULUM-TR.html** veya **KURULUM.txt** dosyasını açın. Her iç ZIP kurulum betiklerini ve kendi Türkçe rehberini içerir. GitHub'ın “Code → Download ZIP” seçeneği bütün kaynak kodu indirir; hızlı kurulum için yukarıdaki paketleri kullanın.

## Hangisini kullanmalıyım?

| | Tek mail paneli | Posta kutusu ajanı |
| --- | --- | --- |
| Amaç | Açık maili analiz etmek, özetlemek ve yanıt hazırlamak | Gelen kutusu/klasörlerde arama ve analiz, taslaklar, posta işlemleri, takvim ve görevler |
| Outlook | Desteklenen hesaplarda web/yeni/klasik Outlook | Yalnız Windows'taki klasik Outlook; açık ve hesabı yapılandırılmış olmalı |
| Eklenti | Outlook'tan mail almak/yanıta eklemek için gerekir; tarayıcıda elle metin de kullanılabilir | Tarayıcıdan kullanım için gerekmez; Outlook içinde panel istenirse yüklenir |
| Değişiklikler | Metni kullanıcı kontrol eder ve gönderir | Ajan işlemleri hazırlar; kullanıcı seçip onayladığında Outlook'a uygulanır |
| Yerel adres | https://localhost:3443 | https://localhost:3447 |
| Kaynak | [tek-mail/](tek-mail/) | [posta-kutusu-ajani/](posta-kutusu-ajani/) |
| Kurulum rehberi | [KURULUM.txt](tek-mail/KURULUM.txt) | [KURULUM.txt](posta-kutusu-ajani/KURULUM.txt) |

Daha ayrıntılı seçim yazısı: [ONCE-BUNU-OKU.txt](ONCE-BUNU-OKU.txt).

## Gerekenler

Windows 10/11, internet, Node.js 22+, Git for Windows, native Claude Code ve Claude Code'da kullanılabilen kendi Claude abonelik hesabınız. Ajan en az Claude Code 2.1.248 ister; güncel sürümü kullanın. Ajan için ayrıca kurulu/lisanslı klasik Outlook gerekir. Model API anahtarı veya Microsoft uygulama kaydı gerekmez.

Bu paketler **Claude Code CLI** kullanır; Claude Desktop sohbet ekranını otomatik kontrol etmez. Desktop'a giriş yapmak tek başına yeterli değildir. Kullanıcı resmî Claude Code üzerinden kendi abonelik hesabına giriş yapar; istekler abonelik kullanım limitinden harcar.

Kurulum sırası: ZIP'i çıkar → `1-KURULUM.cmd` → `2-CLAUDE-GIRIS.cmd` → `4-TANI.cmd` → `3-BASLAT.cmd`. Ajanı kullanırken klasik Outlook açık olmalı. Sertifika/Windows izinlerini kullanıcı kendi ekranında değerlendirir. Program bağımlılıkları ZIP'e gömülü değildir; gerekirse kurulum betiği resmî bağımlılıkları internetten kurmayı dener.

## Kapsam ve veriler

Posta kutusu ajanı sınırsız bilgisayar kontrolü sağlamaz. PDF/Word/Excel eki analizi, toplantı daveti gönderme, kişiler/kurallar/hesap ayarları, kalıcı silme ve sürekli arka plan izleme yoktur. Kullanıcının onaylamadığı değişiklik uygulanmaz; gönderme ayrıca incelenen bir işlem olarak onaylanır. Tarama ve metin sınırları paket rehberinde açıklanır.

Arayüz/köprü yereldir, model bulutta çalışır. Görev için gönderilen/okunan posta bilgileri Claude Code üzerinden Anthropic'e gider. Repo ve ZIP'ler oturum, API anahtarı, kişisel mail, özel sertifika veya yerel ayar içermez. Kurulumdan sonra oluşan `.local` klasörünü paylaşmayın.

## Doğrulama

Tek mail paketinde **12**, ajan paketinde **16** otomatik test geçti. Örnek verilerle tarayıcı/Office.js/MCP ve kullanıcı onayı akışları, betik sözdizimleri ve iki Outlook manifesti kontrol edildi.

**Gerçek Claude hesabı bulunmadığından Claude aboneliğiyle uçtan uca deneme yapılmadı. Gerçek Outlook'ta gönderme/taşıma/silme denenmedi.** İlk denemeyi rehberdeki yalnız okuma göreviyle yapın. Ayrıntılı kayıtlar: [Tek mail](tek-mail/DOGRULAMA.md) · [Ajan](posta-kutusu-ajani/DOGRULAMA.md).

Geliştiriciler için: ilgili kaynak klasöründe `npm test` ve `npm run check`. Otomatik testler gerçek mail göndermeden örnek veriler kullanır. İsteğe bağlı gerçek model testleri otomatik testlere dahil değildir ve Claude kotasını kullanır.

## Resmî belgeler

- [Claude Code kurulumu](https://code.claude.com/docs/en/setup)
- [Abonelikle giriş](https://code.claude.com/docs/en/authentication)
- [CLI seçenekleri](https://code.claude.com/docs/en/cli-reference)
- [MCP bağlantısı](https://code.claude.com/docs/en/mcp)
- [Outlook'a XML eklentisi yükleme](https://learn.microsoft.com/en-us/office/dev/add-ins/outlook/sideload-outlook-add-ins-for-testing)

Hazırlanma tarihi: 11 Ekim 2026.
