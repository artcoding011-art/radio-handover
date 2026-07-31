const fs = require('fs')
const path = require('path')
const xlsx = require('xlsx')
const pdfParse = require('pdf-parse')
const mammoth = require('mammoth')

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error(JSON.stringify({ error: 'No file path provided' }))
    process.exit(1)
  }

  const ext = path.extname(filePath).toLowerCase()
  let text = ''

  try {
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath)
      // pdf-parse 2.4.5 exports an object with PDFParse class/function?
      // Wait, we tested pdfParse is an object.
      // Actually, standard usage for pdf-parse is:
      // const pdf = require('pdf-parse'); pdf(dataBuffer).then(...)
      // But in 2.4.5, is pdf directly callable? Let's assume it is or we call PDFParse.
      // Wait, when I ran node -e, it said `PDFParse: [class (anonymous)]` and `typeof pdf` was object!
      // But the docs for pdf-parse say `pdf(dataBuffer)`. 
      // Let's check if typeof pdf is function. If not, use PDFParse.
      const pdf = typeof pdfParse === 'function' ? pdfParse : pdfParse.PDFParse;
      const data = await pdf(dataBuffer)
      text = data.text || ''
    } else if (ext === '.xls' || ext === '.xlsx' || ext === '.csv') {
      const dataBuffer = fs.readFileSync(filePath)
      const workbook = xlsx.read(dataBuffer, { type: 'buffer' })
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv = xlsx.utils.sheet_to_csv(sheet)
        text += `\n--- Sheet: ${sheetName} ---\n` + csv
      }
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath })
      text = result.value || ''
    } else {
      const textExts = ['.txt', '.md', '.json', '.xml', '.html', '.js', '.ts', '.jsx', '.tsx', '.css']
      if (textExts.includes(ext)) {
        text = fs.readFileSync(filePath, 'utf-8')
      } else {
        text = `[내용을 텍스트로 변환할 수 없는 형식입니다 (${ext})]`
      }
    }
    
    console.log(JSON.stringify({ text }))
  } catch (err) {
    console.log(JSON.stringify({ error: err.message }))
  }
}

main()
