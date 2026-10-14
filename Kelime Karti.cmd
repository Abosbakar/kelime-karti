@echo off
rem Kelime Karti'ni http://localhost:4173 adresinde baslatir ve tarayicida acar.
rem Uygulamayi tarayicidan "uygulama olarak yukle"diysen buna her gun gerek yok;
rem sadece ilk kurulumda ve kod guncellendikten sonra calistir.
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"

if not exist node_modules (
  echo Bagimliliklar kuruluyor...
  call npm install || goto :hata
)

echo Uygulama derleniyor...
call npm run build || goto :hata

start "" "http://localhost:4173/"
echo.
echo Kelime Karti calisiyor: http://localhost:4173/
echo Kapatmak icin bu pencereyi kapat (veriler kaybolmaz).
call npm run preview
goto :eof

:hata
echo.
echo Bir hata olustu, yukaridaki mesajlara bak.
pause
