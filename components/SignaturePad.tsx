'use client'

import { useRef, useEffect, useState } from 'react'

interface SignaturePadProps {
  value: string // Data URL
  onChange: (value: string) => void
  disabled?: boolean
}

export default function SignaturePad({ value, onChange, disabled }: SignaturePadProps) {
  const [showModal, setShowModal] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tempSignature, setTempSignature] = useState('')
  const isDrawing = useRef(false)

  // Modal open handling
  const openModal = () => {
    if (disabled) return
    setTempSignature(value)
    setShowModal(true)
  }

  // Initialize canvas only when modal is fully rendered
  useEffect(() => {
    if (!showModal) return

    const initCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // DPI Setup
      const ratio = window.devicePixelRatio || 1
      const actualWidth = canvas.offsetWidth
      const actualHeight = canvas.offsetHeight
      
      // Prevent unnecessary redraws
      if (canvas.width === actualWidth * ratio && canvas.height === actualHeight * ratio) return

      canvas.width = actualWidth * ratio
      canvas.height = actualHeight * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#000'

      // Load initial image if available
      const currentImgStr = tempSignature || value
      if (currentImgStr) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, actualWidth, actualHeight)
        }
        img.src = currentImgStr
      }
    }

    const timeout = setTimeout(initCanvas, 100)
    window.addEventListener('resize', initCanvas)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', initCanvas)
    }
  }, [showModal, value, tempSignature]) // Added dependencies

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const onStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true
    const { x, y } = getPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    const { x, y } = getPos(e)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const onEnd = () => {
    if (!isDrawing.current) return
    isDrawing.current = false
    const canvas = canvasRef.current
    if (canvas) {
      setTempSignature(canvas.toDataURL('image/png'))
    }
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      setTempSignature('')
    }
  }

  const handleConfirm = () => {
    onChange(tempSignature)
    setShowModal(false)
  }

  const handleSaveAsDefault = () => {
    if (tempSignature) {
      localStorage.setItem('handover_default_signature', tempSignature)
      alert('기본 서명으로 저장되었습니다.')
    }
  }

  return (
    <>
      <div 
        onClick={openModal}
        className={`relative border border-gray-300 rounded overflow-hidden bg-white flex items-center justify-center cursor-pointer transition hover:border-blue-400 ${disabled ? 'bg-gray-50 cursor-default' : 'hover:bg-blue-50'}`} 
        style={{ width: '120px', height: '40px' }}
      >
        {value ? (
          <img src={value} alt="Signature Preview" className="max-w-full max-h-full object-contain" />
        ) : (
          <span className="text-[11px] text-gray-400 font-medium">클릭하여 서명</span>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">디지털 서명</h3>
              <div className="flex items-center gap-4">
                <button onClick={handleSaveAsDefault} disabled={!tempSignature} className="text-sm text-blue-600 hover:text-blue-700 font-medium underline disabled:text-gray-300 disabled:no-underline">기본 서명으로 저장</button>
                <button onClick={clear} className="text-sm text-red-500 hover:text-red-600 font-medium underline">지우기</button>
              </div>
            </div>

            <div className="relative border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 overflow-hidden" style={{ height: '240px' }}>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair touch-none"
                onMouseDown={onStart}
                onMouseMove={onMove}
                onMouseUp={onEnd}
                onMouseLeave={onEnd}
                onTouchStart={onStart}
                onTouchMove={onMove}
                onTouchEnd={onEnd}
              />
              {!tempSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300">여기에 서명해 주세요</div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition">취소</button>
              <button onClick={handleConfirm} className="flex-1 px-4 py-3 bg-blue-900 text-white font-bold rounded-xl hover:bg-blue-800 transition shadow-md">서명 완료</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
