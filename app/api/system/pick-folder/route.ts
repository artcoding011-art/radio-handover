import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import os from 'os'
import util from 'util'

const execPromise = util.promisify(exec)

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const platform = os.platform()
    let command = ''

    if (platform === 'darwin') {
      // macOS: AppleScript를 사용하여 Finder 폴더 선택 창 호출
      command = `osascript -e '
        tell application (path to frontmost application as text)
          set myFolder to choose folder with prompt "분석할 대상 폴더를 선택하세요:"
          return POSIX path of myFolder
        end tell
      '`
    } else if (platform === 'win32') {
      // Windows: PowerShell을 사용하여 FolderBrowserDialog 호출
      // TopMost 속성을 줘서 창이 맨 앞으로 나오도록 합니다.
      command = `powershell -Command "
        Add-Type -AssemblyName System.windows.forms;
        $f = New-Object System.Windows.Forms.FolderBrowserDialog;
        $f.Description = '분석할 대상 폴더를 선택하세요';
        $f.ShowNewFolderButton = $true;
        $f.RootFolder = [System.Environment+SpecialFolder]::MyComputer;
        $form = New-Object System.Windows.Forms.Form;
        $form.TopMost = $true;
        $res = $f.ShowDialog($form);
        if ($res -eq 'OK') { $f.SelectedPath }
      "`
    } else {
      return NextResponse.json({ error: `이 기능은 맥(macOS)과 윈도우(Windows)에서만 지원됩니다. (현재: ${platform})` }, { status: 400 })
    }

    const { stdout } = await execPromise(command)
    const folderPath = stdout.trim()

    if (!folderPath) {
      return NextResponse.json({ error: '폴더 선택이 취소되었습니다.' }, { status: 400 })
    }

    return NextResponse.json({ path: folderPath })
  } catch (error: any) {
    console.error('[pick-folder] Error:', error)
    // 사용자가 취소를 눌렀을 때 AppleScript는 에러를 던짐 (User canceled. (-128))
    if (error.message && error.message.includes('User canceled')) {
      return NextResponse.json({ error: '폴더 선택이 취소되었습니다.' }, { status: 400 })
    }
    return NextResponse.json({ error: '폴더 선택창 호출 중 오류가 발생했습니다: ' + error.message }, { status: 500 })
  }
}
