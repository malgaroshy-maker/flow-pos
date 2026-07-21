@echo off
title Build FlowPOS Installer
chcp 65001 > nul
color 0A

cd /d "%~dp0"

echo ======================================================================
echo         بناء برنامج التثبيت - منظومة Flow لإدارة المبيعات والمخزون
echo ======================================================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :no_node
goto :node_ok

:no_node
color 0C
echo [خطأ] لم يتم العثور على Node.js على هذا الجهاز.
echo يرجى تثبيت Node.js أولاً ثم إعادة تشغيل هذا الملف.
echo.
pause
exit /b 1

:node_ok
if exist "node_modules\" goto :deps_ok
echo [*] جاري تثبيت حزم المنظومة لأول مرة، يرجى الانتظار...
call npm install
if errorlevel 1 goto :install_failed
goto :deps_ok

:install_failed
color 0C
echo [خطأ] فشل تثبيت الحزم. يرجى التحقق وإعادة المحاولة.
echo.
pause
exit /b 1

:deps_ok
echo [*] جاري بناء الخادم والواجهة وتطبيق سطح المكتب...
echo     يشمل ذلك: تحويل الكود، تثبيت مكتبات Electron، وبناء ملف التثبيت
echo.

call npm run package
if errorlevel 1 goto :build_failed
goto :build_ok

:build_failed
color 0C
echo.
echo [خطأ] فشلت عملية البناء. راجع الرسائل أعلاه لمعرفة السبب.
echo.
pause
exit /b 1

:build_ok
echo.
echo ======================================================================
echo  تم بناء برنامج التثبيت بنجاح
echo  الملف موجود في مجلد: dist-installer\
echo ======================================================================
echo.

start "" "%~dp0dist-installer"

pause
