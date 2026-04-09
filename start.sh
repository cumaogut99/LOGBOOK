#!/bin/bash

echo "========================================"
echo "PM Logbook - Hızlı Başlatma"
echo "========================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Bağımlılıklar yükleniyor..."
    npm install
    echo ""
fi

echo "Uygulama başlatılıyor..."
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:5000/api"
echo ""
echo "Giriş bilgileri:"
echo "  Kullanıcı: admin"
echo "  Şifre: adminpass"
echo ""
echo "Kapatmak için Ctrl+C tuşlayınız"
echo ""

npm run dev

