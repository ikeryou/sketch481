import { Contents } from './parts/contents'
import './style.css'

document.querySelectorAll('.l-main').forEach((el,i) => {
  new Contents({
    el: el,
    id: i,
  })
})


