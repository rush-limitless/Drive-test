@echo off
echo ========================================
echo  ADB Framework PDF Generator
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Check if release notes file exists
if not exist "RELEASE_NOTES_v1.0.0.md" (
    echo Error: RELEASE_NOTES_v1.0.0.md not found
    echo Please ensure the release notes file is in the current directory
    pause
    exit /b 1
)

echo Generating PDF from release notes...
echo.

REM Run the PDF generator
python generate_pdf_simple.py

if errorlevel 1 (
    echo.
    echo Error: PDF generation failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  PDF Generation Complete!
echo ========================================
echo.
echo The PDF file has been created:
echo  - ADB_Framework_Release_Notes_v1.0.0.pdf
echo.
echo You can now:
echo  1. Open the PDF file to review
echo  2. Share it with stakeholders
echo  3. Include it in release packages
echo.

REM Ask if user wants to open the PDF
set /p choice="Do you want to open the PDF now? (y/n): "
if /i "%choice%"=="y" (
    start ADB_Framework_Release_Notes_v1.0.0.pdf
)

echo.
echo Press any key to exit...
pause >nul