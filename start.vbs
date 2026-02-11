Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Find the current folder path
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Start Backend (The 0 means HIDDEN)
shell.CurrentDirectory = strPath & "\backend"
shell.Run "cmd /c npm run dev", 0, False

' Start Frontend (The 0 means HIDDEN)
shell.CurrentDirectory = strPath & "\frontend"
shell.Run "cmd /c npm run dev", 0, False

' Wait 10 seconds (to ensure the "Error: Cannot find module" fix worked)
WScript.Sleep 10000

' Open the website
shell.Run "http://localhost:5173"