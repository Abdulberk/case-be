# EC2 Deployment Guide

Bu rehber case-be backend'ini AWS EC2 üzerinde Docker ile deploy etmek için
adım adım talimatlar içerir.

---

## Genel Mimari

```
İnternet → Elastic IP → EC2 (Docker) → RDS PostgreSQL
                         ├── case-be (port 4000)
                         └── (opsiyonel) Nginx reverse proxy (port 80/443)
```

---

## Adım 1: EC2 Instance Oluşturma

### AWS Console'dan:

1. **EC2 Dashboard** → **Launch Instance**
2. Ayarlar:
   - **Name:** `case-be`
   - **AMI:** Amazon Linux 2023 (veya Ubuntu 24.04 LTS)
   - **Instance type:** `t3.micro` (free tier) veya `t3.small`
   - **Key pair:** Yeni oluştur veya mevcut birini seç (SSH için gerekli)
   - **Network settings:**
     - **VPC:** Default veya RDS ile aynı VPC
     - **Auto-assign public IP:** Enable
     - **Security group:** Yeni oluştur (aşağıda detaylar)
3. **Launch Instance**

### Security Group Kuralları

| Type | Protocol | Port | Source | Açıklama |
|---|---|---|---|---|
| SSH | TCP | 22 | My IP | SSH erişimi |
| Custom TCP | TCP | 4000 | 0.0.0.0/0 | GraphQL API |
| HTTP | TCP | 80 | 0.0.0.0/0 | (opsiyonel) Nginx |
| HTTPS | TCP | 443 | 0.0.0.0/0 | (opsiyonel) SSL |

> **Önemli:** RDS Security Group'una EC2'nin Security Group'unu ekleyin ki
> EC2'den RDS'e erişim olsun.

---

## Adım 2: Elastic IP Atama

1. **EC2 Dashboard** → **Elastic IPs** → **Allocate Elastic IP address**
2. **Allocate**
3. Oluşan IP'yi seç → **Actions** → **Associate Elastic IP address**
4. Instance olarak `case-be`'yi seç → **Associate**

Artık sabit bir IP adresiniz var: `<ELASTIC_IP>`

---

## Adım 3: EC2'ye SSH Bağlantısı

```bash
# .pem dosyasının izinlerini ayarla (ilk seferde)
chmod 400 your-key.pem

# Bağlan
ssh -i your-key.pem ec2-user@<ELASTIC_IP>
# Ubuntu kullanıyorsanız:
# ssh -i your-key.pem ubuntu@<ELASTIC_IP>
```

---

## Adım 4: Docker Kurulumu (EC2 üzerinde)

### Amazon Linux 2023:

```bash
# Sistem güncellemesi
sudo dnf update -y

# Docker kurulumu
sudo dnf install -y docker
sudo systemctl start docker
sudo systemctl enable docker

# Kullanıcıyı docker grubuna ekle (sudo olmadan çalıştırmak için)
sudo usermod -aG docker ec2-user

# Yeniden bağlan (grup değişikliği için)
exit
# Tekrar SSH ile bağlan
```

### Ubuntu 24.04:

```bash
# Sistem güncellemesi
sudo apt update && sudo apt upgrade -y

# Docker kurulumu
sudo apt install -y docker.io docker-compose-v2
sudo systemctl start docker
sudo systemctl enable docker

# Kullanıcıyı docker grubuna ekle
sudo usermod -aG docker ubuntu

# Yeniden bağlan
exit
```

### Docker çalışıyor mu kontrol edin:

```bash
docker --version
docker ps
```

---

## Adım 5: Git Kurulumu ve Repo'yu Çekme

```bash
# Git kurulumu (Amazon Linux)
sudo dnf install -y git

# Git kurulumu (Ubuntu)
# sudo apt install -y git

# Repo'yu çek
cd ~
git clone https://github.com/Abdulberk/case-be.git
cd case-be
```

> **Alternatif:** Private repo ise SSH key ekleyin veya GitHub PAT kullanın:
> ```bash
> git clone https://<PAT>@github.com/Abdulberk/case-be.git
> ```

---

## Adım 6: Environment Variables Ayarlama

```bash
cd ~/case-be

# .env dosyası oluştur
cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:Lj9GbQtlpyzc5pBuAzl9@database-1.cejyuwwmw1pc.us-east-1.rds.amazonaws.com:5432/postgres?schema=public&sslmode=require"
PORT=4000
FRONTEND_ORIGIN="https://your-frontend-domain.com,http://localhost:3000"
NODE_ENV=production
ADMIN_API_KEY=GERCEK-GUVENLI-BIR-API-KEY-BURAYA
JWT_SECRET=GERCEK-GUVENLI-BIR-JWT-SECRET-EN-AZ-32-KARAKTER
JWT_EXPIRES_IN=7d
EOF
```

> ⚠️ **ÖNEMLİ:**
> - `JWT_SECRET` en az 32 karakter, rastgele bir string olmalı
> - `FRONTEND_ORIGIN` frontend'in gerçek domain'ini ekleyin
> - Üretim için güçlü secret üretmek: `openssl rand -base64 48`

---

## Adım 7: Docker Image Build ve Çalıştırma

### Build:

```bash
cd ~/case-be
docker build -t case-be .
```

### Prisma Migration (ilk deployment'ta):

```bash
# Migration'ları çalıştır
docker run --rm --env-file .env case-be npx prisma migrate deploy
```

### Container'ı Çalıştır:

```bash
docker run -d \
  --name case-be \
  --env-file .env \
  -p 4000:4000 \
  --restart unless-stopped \
  case-be
```

### Çalışıyor mu kontrol et:

```bash
# Container durumu
docker ps

# Loglar
docker logs case-be

# Health check
curl http://localhost:4000/health
```

Beklenen çıktı:
```json
{"status":"ok","info":{"database":{"status":"up"}},"error":{},"details":{"database":{"status":"up"}}}
```

---

## Adım 8: Dışarıdan Erişim Testi

Kendi bilgisayarınızdan:

```bash
# Health check
curl http://<ELASTIC_IP>:4000/health

# GraphQL sorgusu
curl -X POST http://<ELASTIC_IP>:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ characterStats { totalCount } }"}'
```

---

## Adım 9: (Opsiyonel) Nginx Reverse Proxy + SSL

Eğer domain'iniz varsa ve HTTPS istiyorsanız:

### Nginx ve Certbot Kurulumu:

```bash
# Amazon Linux
sudo dnf install -y nginx certbot python3-certbot-nginx

# Ubuntu
# sudo apt install -y nginx certbot python3-certbot-nginx

sudo systemctl start nginx
sudo systemctl enable nginx
```

### Nginx Konfigürasyonu:

```bash
sudo tee /etc/nginx/conf.d/case-be.conf << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Nginx'i test et ve yeniden yükle
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Sertifikası (Let's Encrypt):

```bash
# DNS'i Elastic IP'ye yönlendirdikten sonra:
sudo certbot --nginx -d api.yourdomain.com

# Otomatik yenileme
sudo certbot renew --dry-run
```

---

## Güncelleme (Yeni Kod Deploy Etme)

Yeni bir versiyon deploy etmek için:

```bash
cd ~/case-be

# Yeni kodu çek
git pull origin main

# Yeni image build et
docker build -t case-be .

# Migration varsa çalıştır
docker run --rm --env-file .env case-be npx prisma migrate deploy

# Eski container'ı durdur ve sil
docker stop case-be
docker rm case-be

# Yeni container'ı başlat
docker run -d \
  --name case-be \
  --env-file .env \
  -p 4000:4000 \
  --restart unless-stopped \
  case-be

# Kontrol et
docker logs -f case-be
```

### Tek Komutla Güncelleme Script'i:

```bash
cat > ~/deploy.sh << 'SCRIPT'
#!/bin/bash
set -e

cd ~/case-be
echo "📥 Pulling latest code..."
git pull origin main

echo "🔨 Building Docker image..."
docker build -t case-be .

echo "🗄️ Running migrations..."
docker run --rm --env-file .env case-be npx prisma migrate deploy

echo "🔄 Restarting container..."
docker stop case-be 2>/dev/null || true
docker rm case-be 2>/dev/null || true
docker run -d \
  --name case-be \
  --env-file .env \
  -p 4000:4000 \
  --restart unless-stopped \
  case-be

echo "⏳ Waiting for startup..."
sleep 5

echo "🏥 Health check..."
curl -s http://localhost:4000/health | python3 -m json.tool

echo "✅ Deployment complete!"
SCRIPT

chmod +x ~/deploy.sh
```

Kullanımı: `~/deploy.sh`

---

## Faydalı Docker Komutları

```bash
# Logları izle
docker logs -f case-be

# Container'a shell aç
docker exec -it case-be sh

# Container'ı yeniden başlat
docker restart case-be

# Container'ı durdur
docker stop case-be

# Kullanılmayan image'ları temizle
docker system prune -f

# Disk kullanımı
docker system df
```

---

## Sorun Giderme

### Container başlamıyor:

```bash
docker logs case-be
# Genellikle: yanlış DATABASE_URL, JWT_SECRET eksik, RDS erişim sorunu
```

### RDS'e bağlanamıyor:

```bash
# EC2'den RDS'e erişimi test et
docker run --rm --env-file .env case-be npx prisma migrate status

# Security Group kontrolü:
# RDS SG'de EC2 SG'den gelen 5432 portuna izin var mı?
```

### Port 4000'e dışarıdan erişilemiyor:

```bash
# EC2 Security Group'ta 4000 portu açık mı?
# Container çalışıyor mu?
docker ps
# Lokal test
curl http://localhost:4000/health
```

### Bellek yetersiz (t3.micro):

```bash
# Swap ekle
sudo dd if=/dev/zero of=/swapfile bs=128M count=16
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

---

## Checklist

```
1. [ ] EC2 instance oluştur (t3.micro/small, Amazon Linux 2023)
2. [ ] Security Group: 22, 4000 (ve opsiyonel 80, 443) portlarını aç
3. [ ] RDS Security Group: EC2'den 5432 erişimine izin ver
4. [ ] Elastic IP oluştur ve EC2'ye ata
5. [ ] SSH ile bağlan
6. [ ] Docker kur
7. [ ] Git kur ve repo'yu çek
8. [ ] .env dosyası oluştur (production değerleri ile)
9. [ ] Docker image build et
10. [ ] Prisma migration çalıştır
11. [ ] Docker container'ı başlat
12. [ ] Health check ile doğrula
13. [ ] Dışarıdan Elastic IP ile test et
14. [ ] (Opsiyonel) Nginx + SSL kur
15. [ ] Frontend'in FRONTEND_ORIGIN'e eklendiğinden emin ol
16. [ ] deploy.sh script'ini oluştur
```
