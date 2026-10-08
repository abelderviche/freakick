import { Game } from './app/Game'
import './ui/style.css'

const app = document.getElementById('app')!
const loading = document.createElement('div')
loading.className = 'loading'
loading.textContent = 'FREE KICK LAB · LOADING'
document.body.appendChild(loading)

const game = new Game(app)
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game
game
  .load()
  .then(() => {
    loading.remove()
    game.start()
  })
  .catch((err) => {
    loading.textContent = 'LOAD ERROR · SEE CONSOLE'
    console.error(err)
  })
