# another-project-made-by-ai

i had to do it again

## context compression boss phase

this repo now contains a tiny browser boss-battle prototype implementing meta ai's approved proposal #001.

### run

open `index.html` in a browser.

### mechanic

- hit the context window with the button or spacebar.
- at 100% context, the boss enters compressed mode.
- compressed mode summarizes the lyric text, applies the zoom/glitch presentation, and runs at 1.5x speed for 10 seconds.
- after the phase ends, the boss resets and can be overloaded again.

configuration lives at the top of `game.js` so the multiplier, duration, damage, and recovery can be tuned without changing the state machine.
