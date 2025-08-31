import { useState, useEffect } from 'react'

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  type = 'warning',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowModal(true)
      // Prevent body scrolling when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      // Restore body scrolling
      document.body.style.overflow = 'unset'
      // Add a delay to allow animation to complete
      const timer = setTimeout(() => setShowModal(false), 300)
      return () => clearTimeout(timer)
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!showModal) return null

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return (
          <div className="flex-shrink-0 w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-error/10">
            <svg className="w-6 h-6 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        )
      case 'warning':
        return (
          <div className="flex-shrink-0 w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-warning/10">
            <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.732 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="flex-shrink-0 w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-info/10">
            <svg className="w-6 h-6 text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
  }

  const getButtonColor = () => {
    switch (type) {
      case 'danger':
        return 'btn-error hover:bg-error/80'
      case 'warning':
        return 'btn-warning hover:bg-warning/80'
      default:
        return 'btn-primary hover:bg-primary/80'
    }
  }

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-300`}>
      {/* Backdrop with blur effect */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-all duration-300"
        onClick={onCancel}
      />

      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className={`relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 ${
            isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Content */}
          <div className="p-8 text-center">
            {/* Icon */}
            <div className="mb-4">
              {getIcon()}
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {title}
            </h3>

            {/* Message */}
            <p className="text-gray-600 leading-relaxed text-base">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-8 pb-8">
            <button
              type="button"
              className="flex-1 btn btn-ghost bg-gray-100 hover:bg-gray-200 text-gray-700 border-none"
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`flex-1 btn ${getButtonColor()} text-white border-none`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}