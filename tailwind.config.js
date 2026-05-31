/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		// Redesign typography stack (Phase 0 of Claude-design rewrite)
  		fontFamily: {
  			sans: ['"Inter Tight"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			serif: ['"Instrument Serif"', 'Georgia', 'serif'],
  			mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			// Redesign palette: warm-ivory surfaces + per-category color worlds
  			// Each category has ink (saturated), bg (soft tint), soft (mid tint).
  			ivory: { DEFAULT: '#FFFCF7', 2: '#F7F4EC' },
  			ink: { DEFAULT: '#0F1419', 2: '#3A3128', 3: '#475569', 4: '#94A3B8' },
  			rule: { DEFAULT: '#F0E9DC', strong: '#E5DDC8' },
  			brand: {
  				teal: '#0E7C73',
  				'teal-mid': '#14B5A6',
  				'teal-light': '#2DD4BF',
  			},
  			cat: {
  				food: { ink: '#E63946', bg: '#FFE4E0', soft: '#FFCFC5' },
  				money: { ink: '#0F9A6B', bg: '#D8F4E5', soft: '#A8E5C4' },
  				coffee: { ink: '#A85A2E', bg: '#F2DDC4', soft: '#E6BC96' },
  				transit: { ink: '#3F49D4', bg: '#DFE2FA', soft: '#BBC2F4' },
  				restroom: { ink: '#0F8A82', bg: '#D2EFEC', soft: '#A7DDD7' },
  				atm: { ink: '#1F5BD6', bg: '#DCE6FB', soft: '#B3C7F4' },
  				weather: { ink: '#D4861A', bg: '#FCEAC9', soft: '#F4D597' },
  				todo: { ink: '#C5197A', bg: '#FBDEEB', soft: '#F2B0D0' },
  				shopping: { ink: '#7C3AED', bg: '#EAE0FA', soft: '#D0B6F4' },
  				culture: { ink: '#8B5A1A', bg: '#F3E2C7', soft: '#E5CA98' },
  				phrases: { ink: '#A37013', bg: '#F8ECC4', soft: '#EED890' },
  				convenience: { ink: '#15803D', bg: '#D4F0DA', soft: '#A4DCB0' },
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}