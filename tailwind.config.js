// The new look's colours come from the same table the app reads at runtime
// (src/components/redesign/worlds.json, wrapped by constants.js), so a class such as
// bg-world-eat-plate and WORLD.eat.plate can never disagree. Tailwind loads this file
// through jiti, which accepts a CommonJS require of JSON.
const T = require('./src/components/redesign/worlds.json');

// Only solid hex values become Tailwind colours; gradients, rgba lines, numbers and
// nested tables (tiers, plaques, the night plate) stay JS-only.
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
const solid = (row) => Object.fromEntries(Object.entries(row).filter(([, v]) => isHex(v)));
const solidRows = (table) => Object.fromEntries(Object.entries(table).map(([k, row]) => [k, solid(row)]));

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
  			// Warm-ivory surfaces and the shared inks. ink is the new look's warm black;
  			// ink.cool is the old cool near-black. No class used the old ink.3 / ink.4 or
  			// colors.cat (the frozen CAT palette lives on in constants.js only).
  			ivory: { DEFAULT: '#FFFCF7', 2: '#F7F4EC' },
  			ink: { DEFAULT: T.neutral.ink, 2: T.neutral.ink2, 3: T.neutral.ink3, cool: T.neutral.inkCool },
  			rule: { DEFAULT: '#F0E9DC', strong: '#E5DDC8' },
  			brand: {
  				teal: '#0E7C73',
  				'teal-mid': '#14B5A6',
  				'teal-light': '#2DD4BF',
  			},
  			// The new look: world-<finder>-<token> (e.g. bg-world-eat-plate),
  			// zone-<zone>-<token>, cloth-<cloth> with -paper, -line and -field, and
  			// cream, stamp and open.
  			world: solidRows(T.world),
  			zone: solidRows(T.zone),
  			cloth: Object.fromEntries(Object.entries(T.cloth).map(([k, c]) => [
  				k, { DEFAULT: c.cloth, paper: c.paper, line: c.line, field: c.fieldLine },
  			])),
  			cream: T.neutral.cream,
  			stamp: T.neutral.stamp,
  			open: T.neutral.open,
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