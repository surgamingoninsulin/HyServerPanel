Set shell = CreateObject("WScript.Shell")

' Kill all Node processes silently
' /F = Force, /IM = Image Name, /T = Kill child processes too
shell.Run "taskkill /F /IM node.exe /T", 0, True

' Optional: Small message to let you know it actually worked
MsgBox "Project Stopped Successfully", 64, "System"