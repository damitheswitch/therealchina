// Logo component - TRC seal stamp logo
export const Logo = ({ size = 36 }) => (
  <svg
    className="logo-mark"
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Seal stamp body */}
    <rect x="6" y="6" width="36" height="36" rx="5" fill="#A6192E" />
    <rect
      x="9"
      y="9"
      width="30"
      height="30"
      rx="3"
      fill="none"
      stroke="#FAF6EF"
      strokeWidth="1.5"
      opacity="0.9"
    />
    {/* Dragon line motif */}
    <path
      d="M16 30c2-3 4-3 6-1s4 2 6-1 4-3 6 0"
      stroke="#C9A227"
      strokeWidth="1.2"
      strokeLinecap="round"
      fill="none"
      opacity="0.8"
    />
    {/* TRC monogram */}
    <text
      x="24"
      y="27"
      textAnchor="middle"
      fill="#FAF6EF"
      fontFamily="Noto Serif SC, serif"
      fontWeight="900"
      fontSize="13"
      letterSpacing="-1"
    >
      TRC
    </text>
  </svg>
)
