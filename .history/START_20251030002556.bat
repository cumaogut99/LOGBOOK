@echo off
echo ========================================
echo PM Logbook - Hizli Baslatma
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Bagimliliklari yukleniyor...
    call npm install
    echo.
)

echo Uygulama baslatiliyor...
echo.
echo Frontend: http://localhost:3000
echo Backend API: http://localhost:5000/api
echo.
echo Giris bilgileri:
echo   Kullanici: admin
echo   Sifre: adminpass
echo.
echo Kapatmak icin Ctrl+C tuslayiniz
echo.

npm run dev

