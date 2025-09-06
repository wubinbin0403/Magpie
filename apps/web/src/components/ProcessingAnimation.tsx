import { useEffect, useState } from 'react'

export type ProcessingStage = 'idle' | 'fetching' | 'analyzing' | 'completed' | 'error'

interface ProcessingAnimationProps {
  stage: ProcessingStage
  message?: string
  progress?: number
  error?: string
}

export default function ProcessingAnimation({ 
  stage, 
  message = '准备开始...', 
  progress,
  error 
}: ProcessingAnimationProps) {
  const [animationKey, setAnimationKey] = useState(0)
  const [waitingChevronIndex, setWaitingChevronIndex] = useState(0)

  // Reset animation when stage changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1)
  }, [stage])

  // Sequential chevron animation for idle stage
  useEffect(() => {
    if (stage === 'idle') {
      const interval = setInterval(() => {
        setWaitingChevronIndex(prev => (prev + 1) % 6) // 6 channel chevrons total
      }, 300)
      return () => clearInterval(interval)
    }
  }, [stage])

  const isActive = (requiredStage: ProcessingStage) => {
    const stageOrder = ['idle', 'fetching', 'analyzing', 'completed']
    const currentIndex = stageOrder.indexOf(stage === 'error' ? 'idle' : stage)
    const requiredIndex = stageOrder.indexOf(requiredStage)
    return currentIndex >= requiredIndex
  }

  const getNodeClass = (nodeStage: ProcessingStage) => {
    if (stage === 'error' && nodeStage === 'error') return 'node-error'
    if (stage === nodeStage) return 'node-active'
    if (isActive(nodeStage)) return 'node-completed'
    return 'node-idle'
  }

  // Unused function - commented out to fix build
  // const getChevronClass = (lineStage: 'fetching' | 'analyzing', chevronIndex: number) => {
  //   const baseClass = (() => {
  //     if (stage === 'error') return 'chevron-error'
  //     if (stage === lineStage) return 'chevron-active'
  //     if (isActive(lineStage)) return 'chevron-completed'
  //     return 'chevron-idle'
  //   })()
  //   
  //   // Add waiting animation for idle stage
  //   if (stage === 'idle') {
  //     const globalIndex = lineStage === 'fetching' ? chevronIndex : chevronIndex + 5
  //     const isWaiting = globalIndex === waitingChevronIndex
  //     return `${baseClass} ${isWaiting ? 'chevron-waiting' : ''}`
  //   }
  //   
  //   return baseClass
  // }

  const getChannelChevronClass = (chevronStage: 'fetching' | 'analyzing', chevronIndex: number) => {
    const baseClass = (() => {
      if (stage === 'error') return 'channel-chevron-error'
      if (stage === chevronStage) return 'channel-chevron-active'
      if (isActive(chevronStage)) return 'channel-chevron-completed'
      return 'channel-chevron-idle'
    })()
    
    // Add waiting animation for idle stage
    if (stage === 'idle') {
      const globalIndex = chevronStage === 'fetching' ? chevronIndex : chevronIndex + 3
      const isWaiting = globalIndex === waitingChevronIndex
      return `channel-chevron ${baseClass} ${isWaiting ? 'channel-chevron-waiting' : ''}`
    }
    
    return `channel-chevron ${baseClass}`
  }

  return (
    <div className="processing-animation-container">
      <style>{`
        .processing-animation-container {
          padding: 2rem;
          background: transparent;
          border-radius: 1rem;
          position: relative;
          overflow: hidden;
        }

        .animation-wrapper {
          position: relative;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .nodes-container {
          display: flex;
          align-items: center;
          gap: 16px;
          position: relative;
          justify-content: center;
        }

        /* Node Styles - Further enlarged icons without circles */
        .node {
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
          transition: all 0.3s ease;
        }

        .node-idle {
          opacity: 0.5;
          color: rgba(190, 177, 165, 1); /* beb1a5 - magpie-100 */
        }

        .node-active {
          opacity: 1;
          color: rgba(5, 150, 105, 1); /* theme green */
        }

        .node-completed {
          opacity: 1;
          color: rgba(5, 150, 105, 1); /* theme green */
        }

        .node-error {
          opacity: 1;
          color: rgba(220, 38, 38, 1); /* error red */
          animation: shake 0.5s ease-in-out;
        }

        /* Custom SVG Chevron Styles - Wide V-shape style */
        .chevron-container {
          display: flex;
          align-items: center;
          gap: 4px;
          justify-content: center;
        }

        .chevron-svg {
          width: 60px;
          height: 40px;
          transition: all 0.3s ease;
        }

        .chevron-idle {
          color: rgba(190, 177, 165, 0.3); /* beb1a5 - dim */
        }

        .chevron-active {
          color: rgba(5, 150, 105, 1); /* theme green */
        }

        .chevron-completed {
          color: rgba(5, 150, 105, 1); /* theme green */
        }

        .chevron-error {
          color: rgba(220, 38, 38, 1); /* error red */
        }

        .chevron-waiting {
          color: rgba(5, 150, 105, 0.8); /* theme green - slightly transparent */
        }

        /* Channel chevron styles */
        .channel-chevron {
          width: 24px;
          height: 24px;
          transition: all 0.3s ease;
        }

        .channel-chevron-idle {
          color: rgba(190, 177, 165, 0.3); /* beb1a5 - dim */
        }

        .channel-chevron-active {
          color: rgba(5, 150, 105, 1); /* theme green */
        }

        .channel-chevron-completed {
          color: rgba(5, 150, 105, 1); /* theme green */
        }

        .channel-chevron-error {
          color: rgba(220, 38, 38, 1); /* error red */
        }

        .channel-chevron-waiting {
          color: rgba(5, 150, 105, 0.6); /* theme green - waiting */
          animation: channelPulse 1s ease-in-out infinite;
        }

        /* Labels - Using Magpie colors */
        .node-label {
          position: absolute;
          bottom: -25px;
          white-space: nowrap;
          font-size: 0.75rem;
          color: rgba(6, 22, 26, 0.8); /* magpie-500 - rich-black */
          font-weight: 500;
        }

        /* Message - Using Magpie colors */
        .message-container {
          text-align: center;
          margin-top: 2.5rem;
        }

        .message-text {
          font-size: 0.875rem;
          color: rgba(6, 22, 26, 0.9); /* magpie-500 - rich-black */
        }

        .progress-bar {
          margin-top: 0.5rem;
          height: 4px;
          background: rgba(190, 177, 165, 0.3); /* magpie-100 */
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: rgba(18, 113, 118, 1); /* magpie-200 - primary color */
          transition: width 0.3s ease;
        }

        /* Animations */
        @keyframes channelPulse {
          0%, 100% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-5px);
          }
          75% {
            transform: translateX(5px);
          }
        }
      `}</style>

      <div className="animation-wrapper">
        <div className="nodes-container" key={animationKey}>
          {/* User Node */}
          <div className={`node ${getNodeClass('fetching')}`}>
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="node-label">站点</span>
          </div>

          {/* Channel Chevrons 1 */}
          <svg className={getChannelChevronClass('fetching', 0)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
          </svg>
          <svg className={getChannelChevronClass('fetching', 1)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
          </svg>
          <svg className={getChannelChevronClass('fetching', 2)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
          </svg>

          {/* Globe Alt Node */}
          <div className={`node ${getNodeClass('fetching')}`}>
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className="node-label">获取内容</span>
          </div>

          {/* Channel Chevrons 2 */}
          <svg className={getChannelChevronClass('analyzing', 0)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
          </svg>
          <svg className={getChannelChevronClass('analyzing', 1)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
          </svg>
          <svg className={getChannelChevronClass('analyzing', 2)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
          </svg>

          {/* AI Node */}
          <div className={`node ${getNodeClass('analyzing')}`}>
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="node-label">AI分析</span>
          </div>
        </div>
      </div>

      <div className="message-container">
        <div className="message-text">
          {stage === 'error' ? (error || '处理失败') : message}
        </div>
        {progress !== undefined && stage !== 'error' && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </div>
    </div>
  )
}