import { motion, useReducedMotion } from 'motion/react'

const BAR_STAGGER = 0.05
const BAR_GROW_SPRING = { type: 'spring', stiffness: 320, damping: 28, mass: 0.8 }

function barRadius(radius) {
  const r = Array.isArray(radius) ? radius[0] : radius ?? 4
  return { rx: r, ry: r }
}

export function MotionBarShape(props) {
  const {
    x,
    y,
    width,
    height,
    fill,
    radius,
    glowColor = 'rgba(15, 23, 42, 0.12)',
    index = 0,
    animate = true,
  } = props
  const reduceMotion = useReducedMotion()
  const { rx, ry } = barRadius(radius)
  const safeHeight = Math.max(height || 0, 0)
  const showSheen = safeHeight > 12 && width > 8

  if (reduceMotion || !isFinite(height) || height <= 0) {
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={safeHeight}
          rx={rx}
          ry={ry}
          fill={fill}
          filter={`drop-shadow(0 2px 6px ${glowColor})`}
        />
        {showSheen && (
          <rect
            x={x + 3}
            y={y + 3}
            width={width - 6}
            height={5}
            rx={2.5}
            fill="rgba(255, 255, 255, 0.22)"
          />
        )}
      </g>
    )
  }

  return (
    <motion.g
      style={{ originY: 1 }}
      initial={animate ? { scaleY: 0, opacity: 0.5 } : false}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ ...BAR_GROW_SPRING, delay: index * BAR_STAGGER }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={rx}
        ry={ry}
        fill={fill}
        filter={`drop-shadow(0 2px 6px ${glowColor})`}
      />
      {showSheen && (
        <rect
          x={x + 3}
          y={y + 3}
          width={width - 6}
          height={5}
          rx={2.5}
          fill="rgba(255, 255, 255, 0.22)"
        />
      )}
    </motion.g>
  )
}

export function MotionActiveBar(props) {
  const {
    x,
    y,
    width,
    height,
    fill,
    radius,
    glowColor = 'rgba(15, 23, 42, 0.12)',
  } = props
  const { rx, ry } = barRadius(radius)

  return (
    <motion.g
      style={{ originY: 1 }}
      initial={{ scaleX: 1, opacity: 1 }}
      animate={{ scaleX: 1.05, opacity: 1 }}
      transition={BAR_GROW_SPRING}
    >
      <rect
        x={x}
        y={y - 3}
        width={width}
        height={height + 3}
        rx={rx}
        ry={ry}
        fill={fill}
        opacity={0.95}
        filter={`drop-shadow(0 3px 8px ${glowColor})`}
      />
    </motion.g>
  )
}

export function MotionTooltip({ children }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.9 }}
    >
      {children}
    </motion.div>
  )
}
