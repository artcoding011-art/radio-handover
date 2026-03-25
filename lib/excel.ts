import { HandoverEntry } from './types'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export function generateExcelHtml(entry: HandoverEntry): string {
  const dateDisplay = format(new Date(entry.date), 'yyyy년 MM월 dd일 (eeee)', { locale: ko })
  const COLS = ['1R', '2R', 'MFM'] as const;

  const styles = `
    <style>
      table { border-collapse: collapse; font-family: 'Malgun Gothic', sans-serif; }
      th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 11pt; text-align: center; }
      .title { font-size: 16pt; font-weight: bold; background-color: #e5e7eb; height: 40px; }
      .info { font-size: 11pt; text-align: left; background-color: #f9fafb; font-weight: bold; }
      .header-rstudio { background-color: #1d4ed8; color: white; font-weight: bold; }
      .header-rmcr { background-color: #6b7280; color: white; font-weight: bold; }
      .header-afs { background-color: #4b5563; color: white; font-weight: bold; }
      .col-header { background-color: #f3f4f6; font-weight: bold; }
      .text-left { text-align: left; }
      .text-green { color: #059669; font-weight: bold; }
      .text-red { color: #dc2626; font-weight: bold; background-color: #fef2f2; }
      .text-gray { color: #9ca3af; }
    </style>
  `;

  const getStyleCol = (val: string) => {
    if (val === '정상') return 'class="text-green"';
    if (val === '불량') return 'class="text-red"';
    if (val === '') return 'class="text-gray"';
    return '';
  };

  const getVal = (val: string) => (val === '' ? '-' : val);

  // MHT Header
  let mht = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----boundary"

------boundary
Content-Type: text/html; charset="utf-8"

<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">${styles}</head><body><table>`;

  // Title
  mht += `<tr><td colspan="4" class="title">라디오 업무 인수인계서</td></tr>`;
  mht += `<tr>
    <td class="info">${dateDisplay}</td>
    <td class="info">근무자: ${entry.근무자}</td>
    <td class="info">결재자: ${entry.결재자}</td>
    <td class="info" style="width:120pt;">확인: ${entry.서명 ? `<img src="cid:signature" width="100" height="40" />` : '(미서명)'}</td>
  </tr>`;
  mht += `<tr><td colspan="4"></td></tr>`;

  // R-Studio
  mht += `<tr><td colspan="4" class="header-rstudio">R-Studio</td></tr>`;
  mht += `<tr><th class="col-header">항목</th><th class="col-header">1R</th><th class="col-header">2R</th><th class="col-header">MFM</th></tr>`;
  
  mht += `<tr><td class="text-left">일일편성정보 확인 (로컬,CM)</td>`;
  COLS.forEach(c => mht += `<td ${getStyleCol(entry.rStudio.일일편성정보확인[c])}>${getVal(entry.rStudio.일일편성정보확인[c])}</td>`);
  mht += `</tr>`;

  const studioChecks: [keyof HandoverEntry['rStudio']['체크항목'], string][] = [
    ['mixer', 'Mixer 각종 램프/파워 상태'],
    ['display모니터', 'Display모니터/라우터 확인'],
    ['로컬녹음단말', '로컬녹음단말 녹음여부 확인'],
    ['ST내부모니터', 'ST내부 모니터/스피커 확인'],
  ];
  studioChecks.forEach(([key, label]) => {
    mht += `<tr><td class="text-left">${label}</td>`;
    COLS.forEach(c => mht += `<td ${getStyleCol(entry.rStudio.체크항목[key][c])}>${getVal(entry.rStudio.체크항목[key][c])}</td>`);
    mht += `</tr>`;
  });

  mht += `<tr><td class="text-left bg-blue-50 font-bold">현업주요사항 (R-Studio)</td>`;
  mht += `<td colspan="3" class="text-left">${entry.rStudio.현업주요사항.replace(/\n/g, '<br/>')}</td></tr>`;

  // R-MCR
  mht += `<tr><td colspan="4"></td></tr>`;
  mht += `<tr><td colspan="4" class="header-rmcr">R-MCR</td></tr>`;
  mht += `<tr><th class="col-header">항목</th><th class="col-header">1R</th><th class="col-header">2R</th><th class="col-header">MFM</th></tr>`;
  
  const mcrItems: [keyof HandoverEntry['rMCR'], string][] = [
    ['모니터', 'LG MUX / PIC(1R/2R/MFM) / D-KNC → 모니터'],
    ['매체별송출서버', '매체별 송출서버 (주)(예)'],
    ['디스플레이서버시간성보', '디스플레이 서버 시간 정보 표시'],
    ['편성단말', '편성단말 정상 동작'],
  ];
  mcrItems.forEach(([key, label]) => {
    if (key === '특이사항') return;
    mht += `<tr><td class="text-left">${label}</td>`;
    COLS.forEach(c => {
      const val = (entry.rMCR[key] as any)[c];
      mht += `<td ${getStyleCol(val)}>${getVal(val)}</td>`;
    });
    mht += `</tr>`;
  });
  mht += `<tr><td class="text-left bg-gray-50 font-bold">특이사항 (R-MCR)</td>`;
  mht += `<td colspan="3" class="text-left">${entry.rMCR.특이사항.replace(/\n/g, '<br/>')}</td></tr>`;

  // AFS
  mht += `<tr><td colspan="4"></td></tr>`;
  mht += `<tr><td colspan="4" class="header-afs">AFS - 1R/2R/MFM</td></tr>`;
  mht += `<tr><th class="col-header">항목</th><th class="col-header">1R</th><th class="col-header">2R</th><th class="col-header">MFM</th></tr>`;

  const afsKeys: [keyof HandoverEntry['afs'], string][] = [
    ['라우터', '라디오 주/예비 라우터'],
    ['CASS', 'CASS 동작상태'],
    ['1R_MFM송출서버', '1R / MFM 송출서버'],
    ['2R송출서버', '2R 송출서버'],
    ['디스플레이서버', '디스플레이 서버'],
    ['편성단말', '편성단말'],
    ['DB서버', 'DB 서버'],
    ['네트워크스위치', '네트워크 스위치'],
    ['통합제어디코더', '통합제어 다코더'],
  ];
  afsKeys.forEach(([key, label]) => {
    mht += `<tr><td class="text-left">${label}</td>`;
    COLS.forEach(c => mht += `<td ${getStyleCol(entry.afs[key][c])}>${getVal(entry.afs[key][c])}</td>`);
    mht += `</tr>`;
  });

  mht += `</table></body></html>

------boundary`;

  // Add signature image if exists
  if (entry.서명) {
    const base64Data = entry.서명.split(',')[1];
    mht += `
Content-Type: image/png
Content-Transfer-Encoding: base64
Content-ID: <signature>

${base64Data}

------boundary--`;
  } else {
    mht += `--`;
  }

  return mht;
}
