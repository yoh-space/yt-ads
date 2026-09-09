import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        main: "hsl(var(--bg-main))",
        surface: "hsl(var(--bg-surface))",
        "surface-elevated": "hsl(var(--bg-surface-elevated))",
        "border-token": "hsl(var(--border-color))",
        "text-primary": "hsl(var(--text-primary))",
        "text-secondary": "hsl(var(--text-secondary))",
        "text-dim": "hsl(var(--text-dim))",
        "brand-primary": "hsl(var(--brand-primary))",
        "brand-primary-light": "hsl(var(--brand-primary-light))",
        "brand-primary-bg": "hsl(var(--brand-primary-bg))",
        "status-success": "hsl(var(--status-success))",
        "status-success-bg": "hsl(var(--status-success-bg))",
        "status-warning": "hsl(var(--status-warning))",
        "status-warning-bg": "hsl(var(--status-warning-bg))",
        // Base Canvas & Background
        canvas: "hsl(var(--canvas))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Brand Colors
        navy: {
          DEFAULT: "hsl(var(--navy))",
          2: "hsl(var(--navy-2))",
        },
        ink: "hsl(var(--ink))",
        cyan: {
          DEFAULT: "hsl(var(--cyan))",
          dark: "hsl(var(--cyan-dark))",
        },
        gold: "hsl(var(--gold))",
        violet: "hsl(var(--violet))",
        blue: "hsl(var(--blue))",
        green: "hsl(var(--green))",
        coral: "hsl(var(--coral))",

        // UI Tokens
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        amber: {
          500: "hsl(var(--amber))",
        },
        emerald: {
          500: "hsl(var(--emerald))",
        },
        purple: {
          900: "hsl(var(--purple))",
          300: "hsl(var(--purple-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        // Status & Alert Tokens
        glow: "#00B4D8",
        active: "#38B000",
        pulse: "#FFB703",
        shortage: {
          DEFAULT: "hsl(var(--shortage))",
          foreground: "hsl(var(--shortage-foreground))",
        },
        surplus: {
          DEFAULT: "hsl(var(--surplus))",
          foreground: "hsl(var(--surplus-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },

        // Additional Tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        line: "hsl(var(--line))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        custom: "var(--shadow)",
        "brand-glow": "0 0 24px hsl(var(--brand-primary) / 0.22)",
      },
      fontFamily: {
        sans: ["Inter", '"Noto Sans Ethiopic"', "sans-serif"],
        jakarta: ["Plus Jakarta Sans", '"Noto Sans Ethiopic"', "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      fontSize: {
        xs: ["9px", { lineHeight: "1.3" }],
        sm: ["10px", { lineHeight: "1.4" }],
        base: ["14px", { lineHeight: "1.5" }],
        lg: ["18px", { lineHeight: "1.35" }],
        xl: ["21px", { lineHeight: "1.35" }],
        "2xl": ["24px", { lineHeight: "1.2" }],
        "3xl": ["30px", { lineHeight: "1.1" }],
      },
      maxWidth: {
        "page": "1600px",
      },
      animation: {
        "mc-slide-in": "mcSlideIn 0.15s ease-out",
        "inventory-loader-spin": "inventory-loader-spin 1.1s linear infinite",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
        "telemetry-scroll": "telemetryScroll 38s linear infinite",
        "slide-in-right": "slideInRight 0.25s ease-out",
      },
      keyframes: {
        slideInRight: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        mcSlideIn: {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "inventory-loader-spin": {
          "100%": { transform: "rotate(360deg)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", boxShadow: "0 0 0 0 rgba(255, 183, 3, 0.55)" },
          "50%": { opacity: "0.65", boxShadow: "0 0 0 4px rgba(255, 183, 3, 0)" },
        },
        telemetryScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
