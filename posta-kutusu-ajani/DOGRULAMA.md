# Doğrulama — 11 Ekim 2026

Windows ve Node.js 24.11.0 ortamında hazırlanmış kişisel kullanım prototipidir.

- 16 otomatik test geçti: Claude CLI seçenekleri, abonelik/API ayrımı, alt işlem ortamının temizlenmesi, stream-json çözümleme ve beklenmeyen araç/bağlantı reddi, gerçek stdio MCP protokolüyle örnek posta kutusu okuma ve onaysız değişiklik uygulamama, geçici iş dosyalarının temizlenmesi, mevcut posta motoru doğrulamaları ve HTTP kullanıcı onayı/tek uygulama akışı.
- Tarayıcı testi örnek veriyle çalıştırıldı: 390 piksel panel, sohbet, tam taslak önizlemesi, HTML kaçışları, varsayılan seçilmemiş kartlar, yalnız düğmeyle uygulama, tekrar uygulamayı reddetme ve sohbet sıfırlama. Gerçek Outlook yerine sentetik backend kullanıldı.
- JavaScript ve PowerShell sözdizimi kontrolleri yapıldı. Windows PowerShell betikleri UTF-8 BOM; CMD dosyaları Windows satır sonlarıyla kaydedildi.
- İki manifestin kimlikleri/portları farklıdır; XML şeması ve Microsoft manifest doğrulama aracıyla kontrol edildi.
- Klasik Outlook COM betiği, önceki Codex ajanında 1 posta deposu/22 klasör, mesaj metni, takvim/görev okumasıyla sınanan betiğin aynısıdır. Bu geçmiş kanıt Claude model bağlantısını doğrulamaz.
- Yeni gerçek-model denemesi için tests/native-demo.mjs bulunur. Kurulum ve Claude abonelik girişi sonrası isteğe bağlı çalıştırılır; örnek posta kutusu kullanır, gerçek Outlook maillerini okumaz/değiştirmez, Claude kullanım kotasını harcar. Bu bilgisayarda çalıştırılmadı.

**Denemediğimiz kısım:** Bu bilgisayarda Claude hesabı/oturumu bulunmadığından gerçek Claude Code → MCP → hedef Outlook akışı uçtan uca denenmedi. Gerçek Outlook'ta değişiklik, mail gönderme/taşıma/silme ve Outlook içine gömülü panel denenmedi. Sentetik testler bunların yerine geçmez. Dağıtım rehberindeki ilk yalnız okuma göreviyle kullanıcı bilgisayarında doğrulayın.

Dağıtım ZIP'lerinde .local, .qa, giriş oturumu, kişisel posta, pfx/cer veya config.json yoktur. Kurulum sertifikası ve yapılandırması her kullanıcıda yeniden üretilir. Paket bağımlılıkları kullanıcının bilgisayarına bu hazırlama sırasında kurulmadı; çalışan Codex test sunucusu değiştirilmedi.
