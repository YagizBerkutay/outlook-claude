# Doğrulama — 11 Ekim 2026

Bu paket kişisel kullanım prototipidir. Windows'ta Node.js 24.11.0 ile aşağıdaki kontroller yapıldı.

## Tamamlanan kontroller

- **12 bağlantı/CLI testi geçti:** yerel sayfa ve token, farklı kaynaktan istek engelleme, host kontrolü, girdi sınırları, abonelik oturumu gereksinimi, API hesabını reddetme, çağrıları sıraya almadan meşgul hatası verme, hata sonrası yeniden deneme, alt işlem ortamında API ayarlarını temizleme, e-postayı shell komutu yerine stdin verisi olarak iletme, Türkçe karakterler, iptal, zaman aşımı ve bozuk yanıtlar.
- **JavaScript sözdizimi kontrolleri geçti:** HTTPS sunucusu, köprü, CLI bağlantısı ve panel.
- **PowerShell betiklerinin sözdizimi doğrulandı.** Betikler Windows PowerShell 5.1 için UTF-8 BOM ile kaydedildi. CMD dosyaları Windows satır sonlarıyla kaydedildi.
- **Microsoft `office-addin-manifest` doğrulaması geçti:** XML şeması, read/compose panel tanımları, HTTPS adresleri, simgeler ve Mailbox gereksinimleri geçerli. Araç sonucu: `The manifest is valid.`
- **Gerçek Chrome tarayıcısında mock test geçti:** örnek mail metninden taklit yanıt üretme, 360 piksel genişlikte panel, Türkçe metin, kopyalama düğmesi durumu ve rehber görüntüsü.
- **Taklit Office.js bağlantısıyla read/compose testleri geçti:** e-posta okuma, yanıt penceresini HTML karakterleri kaçırılarak açma, taslağa düz metin ekleme, e-posta değişince eski sonucu temizleme.
- **Panel ve kurulum rehberi ekran görüntüleri görsel olarak incelendi.**

## Kullanıcının bilgisayarında yapılması gerekenler

- Winget üzerinden gerçek bağımlılık kurulumu ve localhost sertifikasının kullanıcı deposuna eklenmesi.
- Kullanıcının Claude Pro/Max hesabıyla native Claude Code'a gerçek giriş yapması.
- Abonelik üzerinden gerçek Claude yanıtı alınması ve güncel CLI sürümünde tüm bayrakların çalışması.
- Hedef Outlook sürümünde `manifest.xml` dosyasının yüklenmesi, panelin açılması, gerçek e-posta okuma ve yanıta metin ekleme.
- Kurumsal eklenti/sertifika/yerel ağ politikaları ve tarayıcı izinleri.

Bu bilgisayarda Claude Code abonelik girişi ve hedef Outlook oturumu olmadığı için yukarıdaki gerçek uçtan uca kontrol yapılmadı. Mock testler bu doğrulamanın yerine geçmez. İlk kurulumda rehberin tarayıcı örnek metin denemesi ve ardından Outlook denemesi uygulanmalıdır.

## Testleri tekrar çalıştırma

```powershell
npm.cmd test
npm.cmd run check
node tests/ui-smoke.mjs
npx.cmd --yes office-addin-manifest validate manifest.xml
```

Tarayıcı testi Chrome veya Edge kullanır, gerçek Claude hesabına bağlanmaz. Test ekran görüntüleri ve geçici tarayıcı profilleri `.qa/` klasörüne yazılır. `.qa/` ve `.local/` dağıtım ZIP'ine dahil edilmez.
