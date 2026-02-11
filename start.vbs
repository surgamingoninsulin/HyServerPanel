Option Explicit

Dim fso, shell, rootPath, runDir
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

rootPath = fso.GetParentFolderName(WScript.ScriptFullName)
runDir = rootPath & "\.run"

If Not fso.FolderExists(runDir) Then
    fso.CreateFolder(runDir)
End If

Call StartService("backend", "cmd.exe /c cd /d """ & rootPath & "\backend"" && if not defined WARDEN_ENABLED set ""WARDEN_ENABLED=false"" && if not defined MONGODB_URI set ""MONGODB_URI=mongodb://localhost:27017/modtale"" && if not defined R2_BUCKET_NAME set ""R2_BUCKET_NAME=modtale-local"" && if not defined R2_ACCESS_KEY set ""R2_ACCESS_KEY=local-dev-key"" && if not defined R2_SECRET_KEY set ""R2_SECRET_KEY=local-dev-secret"" && if not defined R2_ENDPOINT set ""R2_ENDPOINT=https://example.com"" && if not defined R2_PUBLIC_DOMAIN set ""R2_PUBLIC_DOMAIN=https://example.com"" && gradlew.bat bootRun > """ & runDir & "\backend.log"" 2>&1", runDir & "\backend.pid")
Call StartService("frontend", "cmd.exe /c cd /d """ & rootPath & "\frontend"" && if not defined PUBLIC_API_URL set ""PUBLIC_API_URL=http://localhost:8080/api/v1"" && npm run dev > """ & runDir & "\frontend.log"" 2>&1", runDir & "\frontend.pid")
Call OpenFrontendPage()

Sub StartService(name, commandLine, pidPath)
    Dim wmi, processClass, processStartup, pid, result
    Set wmi = GetObject("winmgmts:\\.\root\cimv2")
    Set processClass = wmi.Get("Win32_Process")
    Set processStartup = wmi.Get("Win32_ProcessStartup").SpawnInstance_
    processStartup.ShowWindow = 0

    If IsServiceRunning(pidPath) Then
        Call AppendLog(name & " already running (PID " & ReadText(pidPath) & ").")
        Exit Sub
    End If

    result = processClass.Create(commandLine, Null, processStartup, pid)
    If result = 0 Then
        Call WriteText(pidPath, CStr(pid))
        Call AppendLog("Started " & name & " (PID " & pid & ").")
    Else
        Call AppendLog("Failed to start " & name & " (WMI error " & result & ").")
    End If
End Sub

Function IsServiceRunning(pidPath)
    Dim pid, rc
    IsServiceRunning = False

    If Not fso.FileExists(pidPath) Then
        Exit Function
    End If

    pid = Trim(ReadText(pidPath))
    If pid = "" Then
        On Error Resume Next
        fso.DeleteFile pidPath, True
        On Error GoTo 0
        Exit Function
    End If

    rc = shell.Run("cmd.exe /c tasklist /FI ""PID eq " & pid & """ | findstr /R /C:"" " & pid & " "" >nul", 0, True)
    If rc = 0 Then
        IsServiceRunning = True
    End If
End Function

Function ReadText(filePath)
    Dim stream
    Set stream = fso.OpenTextFile(filePath, 1, False)
    ReadText = Trim(stream.ReadAll)
    stream.Close
End Function

Sub WriteText(filePath, textValue)
    Dim stream
    Set stream = fso.OpenTextFile(filePath, 2, True)
    stream.Write textValue
    stream.Close
End Sub

Sub AppendLog(message)
    Dim stream
    Set stream = fso.OpenTextFile(runDir & "\launcher.log", 8, True)
    stream.WriteLine Now & " | " & message
    stream.Close
End Sub

Sub OpenFrontendPage()
    ' Give the frontend dev server a moment to boot.
    WScript.Sleep 5000
    shell.Run "cmd.exe /c start """" ""http://localhost:5173""", 0, False
End Sub
