@echo off
echo ========================================
echo  ADB Framework Word Document Generator
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

REM Check if required Markdown files exist
if not exist "IMPLEMENTATION_REVIEW_v1.0.0.md" (
    echo Warning: IMPLEMENTATION_REVIEW_v1.0.0.md not found
)

if not exist "RELEASE_NOTES_v1.0.0_REVISED.md" (
    echo Warning: RELEASE_NOTES_v1.0.0_REVISED.md not found
)

echo Generating Word documents from Markdown files...
echo.

REM Run the Word document generator
python generate_word_docs.py

if errorlevel 1 (
    echo.
    echo Error: Word document generation failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Word Document Generation Complete!
echo ========================================
echo.
echo The following Word documents have been created:
echo  - ADB_Framework_Implementation_Review_v1.0.0.docx
echo  - ADB_Framework_Release_Notes_v1.0.0_Revised.docx
echo.

REM Ask if user wants to open the documents
set /p choice="Do you want to open the Word documents now? (y/n): "
if /i "%choice%"=="y" (
    if exist "ADB_Framework_Implementation_Review_v1.0.0.docx" (
        start ADB_Framework_Implementation_Review_v1.0.0.docx
    )
    if exist "ADB_Framework_Release_Notes_v1.0.0_Revised.docx" (
        start ADB_Framework_Release_Notes_v1.0.0_Revised.docx
    )
)

echo.
echo Press any key to exit...
pause >nul