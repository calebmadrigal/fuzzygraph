module.exports = {
  content: ["./src/*.html"],
  theme: { extend: {} },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio')
  ],
  safelist: [
    'md:flex'
  ]
};

