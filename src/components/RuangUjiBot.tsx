import { motion } from 'framer-motion';

type BotState = 'idle' | 'speaking' | 'thinking' | 'listening';

interface RuangUjiBotProps {
    state?: BotState;
    size?: number;
    className?: string;
}

function SpeakingBubbles() {
    return (
        <motion.g>
            {/* Left status bubbles */}
            <motion.circle
                cx="42"
                cy="122"
                r="16"
                fill="#DBEAFE"
                animate={{ scale: [0.9, 1.18, 0.9], opacity: [0.55, 0.85, 0.55] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
                cx="42"
                cy="122"
                r="8"
                fill="#60A5FA"
                animate={{ scale: [0.75, 1.08, 0.75], opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.circle
                cx="67"
                cy="148"
                r="5"
                fill="#60A5FA"
                animate={{ scale: [0.7, 1.25, 0.7], opacity: [0.35, 0.9, 0.35] }}
                transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut', delay: 0.18 }}
            />

            {/* Right status bubbles */}
            <motion.circle
                cx="292"
                cy="166"
                r="16"
                fill="#DBEAFE"
                animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.55, 0.85, 0.55] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
            />
            <motion.circle
                cx="292"
                cy="166"
                r="8"
                fill="#60A5FA"
                animate={{ scale: [0.75, 1.08, 0.75], opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
            />
            <motion.circle
                cx="268"
                cy="142"
                r="5"
                fill="#60A5FA"
                animate={{ scale: [0.7, 1.25, 0.7], opacity: [0.35, 0.9, 0.35] }}
                transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            />
        </motion.g>
    );
}

export default function RuangUjiBot({
    state = 'idle',
    size = 220,
    className = '',
}: RuangUjiBotProps) {
    const isSpeaking = state === 'speaking';
    const isThinking = state === 'thinking';
    const isListening = state === 'listening';

    return (
        <motion.div
            className={className}
            style={{
                width: size,
                height: size,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
            }}
            animate={
                isSpeaking
                    ? { y: [0, -6, 0], rotate: [0, -1.2, 1.2, 0] }
                    : isListening
                        ? { scale: [1, 1.035, 1] }
                        : isThinking
                            ? { y: [0, -3, 0] }
                            : { y: [0, -2, 0] }
            }
            transition={{
                duration: isSpeaking ? 1.15 : 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 320 320"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ overflow: 'visible' }}
            >
                {/* Speaking bubble effect */}
                {isSpeaking && <SpeakingBubbles />}

                {/* Shadow */}
                <motion.ellipse
                    cx="160"
                    cy="288"
                    rx="72"
                    ry="12"
                    fill="rgba(15, 23, 42, 0.10)"
                    animate={{
                        scaleX: isSpeaking ? [1, 0.92, 1] : [1, 0.96, 1],
                        opacity: isSpeaking ? [0.16, 0.08, 0.16] : [0.12, 0.08, 0.12],
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Graduation Hat */}
                <motion.g
                    animate={isSpeaking ? { rotate: [-1.2, 1.2, -1.2] } : { rotate: [0, 0.8, 0] }}
                    transition={{ duration: isSpeaking ? 1.1 : 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: '160px 96px' }}
                >
                    <path
                        d="M160 26L252 88C258 92 258 100 252 104L160 164L68 104C62 100 62 92 68 88L160 26Z"
                        fill="#2563EB"
                    />

                    {/* Bagian bawah topi dibuat lebih kecil/compact */}
                    <path
                        d="M101 103C101 83 124 72 160 72C196 72 219 83 219 103V123H101V103Z"
                        fill="#2563EB"
                        stroke="white"
                        strokeWidth="7"
                    />
                    <path
                        d="M101 118C137 114 183 114 219 118"
                        stroke="white"
                        strokeWidth="7"
                        strokeLinecap="round"
                    />
                </motion.g>

                {/* Ears */}
                <motion.path
                    d="M52 166C34 177 28 188 28 205V225C28 241 41 254 57 254H77V150H57C55 156 54 162 52 166Z"
                    fill="#DBEAFE"
                    animate={isSpeaking ? { x: [0, -3, 0] } : { x: 0 }}
                    transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.path
                    d="M268 166C286 177 292 188 292 205V225C292 241 279 254 263 254H243V150H263C265 156 266 162 268 166Z"
                    fill="#DBEAFE"
                    animate={isSpeaking ? { x: [0, 3, 0] } : { x: 0 }}
                    transition={{ duration: 0.75, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Head */}
                <motion.rect
                    x="56"
                    y="118"
                    width="208"
                    height="158"
                    rx="48"
                    fill="#2563EB"
                    stroke="#EFF6FF"
                    strokeWidth="12"
                    animate={
                        isThinking
                            ? { rotate: [0, -1.2, 1.2, 0] }
                            : isSpeaking
                                ? { scale: [1, 1.018, 1] }
                                : { scale: [1, 1.006, 1] }
                    }
                    transition={{ duration: isSpeaking ? 0.9 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: '160px 198px' }}
                />

                {/* Face shine */}
                <path
                    d="M82 146C92 133 112 126 142 126H208C229 126 243 137 249 154C237 145 222 141 201 141H122C103 141 91 143 82 146Z"
                    fill="rgba(255,255,255,0.14)"
                />

                {/* Eyes group */}
                <motion.g
                    animate={
                        isListening
                            ? { x: [-4, 4, -4] }
                            : isThinking
                                ? { x: [-6, 0, 6, 0, -6] }
                                : { x: [0, 4, 0, -4, 0] }
                    }
                    transition={{
                        duration: isThinking ? 2.2 : 3.2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                >
                    <motion.rect
                        x="108"
                        y="163"
                        width="24"
                        height="64"
                        rx="7"
                        fill="white"
                        animate={{
                            scaleY: [1, 1, 0.08, 1, 1],
                        }}
                        transition={{
                            duration: 3.2,
                            times: [0, 0.86, 0.9, 0.94, 1],
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        style={{ transformOrigin: '120px 195px' }}
                    />

                    <motion.rect
                        x="188"
                        y="163"
                        width="24"
                        height="64"
                        rx="7"
                        fill="white"
                        animate={{
                            scaleY: [1, 1, 0.08, 1, 1],
                        }}
                        transition={{
                            duration: 3.2,
                            times: [0, 0.86, 0.9, 0.94, 1],
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        style={{ transformOrigin: '200px 195px' }}
                    />
                </motion.g>

                {/* Speaking mouth / equalizer */}
                {isSpeaking && (
                    <motion.g
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.rect
                            x="139"
                            y="240"
                            width="8"
                            height="18"
                            rx="4"
                            fill="white"
                            animate={{ height: [10, 24, 12], y: [246, 232, 244] }}
                            transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.rect
                            x="156"
                            y="236"
                            width="8"
                            height="22"
                            rx="4"
                            fill="white"
                            animate={{ height: [22, 10, 26], y: [236, 248, 232] }}
                            transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut', delay: 0.08 }}
                        />
                        <motion.rect
                            x="173"
                            y="240"
                            width="8"
                            height="18"
                            rx="4"
                            fill="white"
                            animate={{ height: [12, 26, 10], y: [244, 230, 246] }}
                            transition={{ duration: 0.55, repeat: Infinity, ease: 'easeInOut', delay: 0.16 }}
                        />
                    </motion.g>
                )}

                {/* Thinking dots */}
                {isThinking && (
                    <motion.g>
                        {[0, 1, 2].map((i) => (
                            <motion.circle
                                key={i}
                                cx={142 + i * 18}
                                cy="244"
                                r="4"
                                fill="white"
                                animate={{ opacity: [0.25, 1, 0.25], y: [0, -4, 0] }}
                                transition={{
                                    duration: 0.9,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                    delay: i * 0.15,
                                }}
                            />
                        ))}
                    </motion.g>
                )}

                {/* Listening pulse */}
                {isListening && (
                    <motion.g>
                        <motion.circle
                            cx="160"
                            cy="198"
                            r="95"
                            stroke="#93C5FD"
                            strokeWidth="4"
                            fill="transparent"
                            animate={{ r: [92, 116], opacity: [0.35, 0] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                        />
                        <motion.circle
                            cx="160"
                            cy="198"
                            r="105"
                            stroke="#60A5FA"
                            strokeWidth="3"
                            fill="transparent"
                            animate={{ r: [96, 128], opacity: [0.22, 0] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.25 }}
                        />
                    </motion.g>
                )}
            </svg>
        </motion.div>
    );
}