@echo off
REM Extract guidelines using Ollama AI and compare

echo ==========================================
echo PDF Guideline Extractor with Ollama AI
echo ==========================================
echo.

REM Check if PDF file provided
if "%~1"=="" (
    echo Usage: extract_and_compare.bat "path\to\seller_guide.pdf" "path\to\newfi_guide.pdf"
    exit /b 1
)

set SELLER_PDF=%~1
set NEWFI_PDF=%~2

REM Check Ollama is running
echo Checking Ollama...
curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo ERROR: Ollama is not running!
    echo Please start Ollama first: ollama serve
    exit /b 1
)

echo Ollama is running.
echo.

REM Extract seller guidelines
if exist "%SELLER_PDF%" (
    echo Extracting seller guidelines from: %SELLER_PDF%
    python ollama_guideline_extractor.py "%SELLER_PDF%" -o seller_guidelines.json
    if errorlevel 1 (
        echo ERROR: Failed to extract seller guidelines
        exit /b 1
    )
) else (
    echo ERROR: Seller PDF not found: %SELLER_PDF%
    exit /b 1
)

REM Extract Newfi guidelines if provided
if not "%NEWFI_PDF%"=="" (
    if exist "%NEWFI_PDF%" (
        echo.
        echo Extracting Newfi guidelines from: %NEWFI_PDF%
        python ollama_guideline_extractor.py "%NEWFI_PDF%" -o newfi_guidelines.json
        if errorlevel 1 (
            echo ERROR: Failed to extract Newfi guidelines
            exit /b 1
        )
    ) else (
        echo WARNING: Newfi PDF not found: %NEWFI_PDF%
        echo Using newfiGuidelines.ts as fallback
    )
)

REM Compare if both exist
if exist "seller_guidelines.json" (
    if exist "newfi_guidelines.json" (
        echo.
        echo Comparing guidelines...
        python ollama_compare.py seller_guidelines.json newfi_guidelines.json -o comparison_results.xlsx
        if errorlevel 1 (
            echo ERROR: Comparison failed
            exit /b 1
        )
        echo.
        echo ==========================================
        echo Complete! Files created:
        echo   - seller_guidelines.json
        echo   - newfi_guidelines.json
        echo   - comparison_results.xlsx
        echo ==========================================
    ) else (
        echo.
        echo Seller guidelines extracted to: seller_guidelines.json
        echo Run with Newfi PDF to compare.
    )
)

pause
