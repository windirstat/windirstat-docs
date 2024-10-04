@ECHO OFF

FOR %%X IN (*.html) DO tidy -tidy-mark no -wrap 10000 -indent -m %%X

SET NL=[System.Environment]::NewLine
FOR %%X IN (*.html) DO POWERSHELL -Command "[System.IO.File]::ReadAllText('%%X') -replace ('(' + %NL% +')+'),%NL% | Out-File '%%X' -Force -Encoding utf8"