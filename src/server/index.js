import 'babel-polyfill'
import http from 'http'
import fs from 'fs'
import url from 'url'
import path from 'path'
import socketIo from 'socket.io'
import wait from 'wait-then'
import axios from 'axios'

const app = http.createServer(handler)
const io = socketIo(app)

app.listen(5555)

function handler (req, res) {
  const reqPath = url.parse(req.url).pathname

  switch (reqPath) {
    case '/':
      fs.readFile(path.join(__dirname, '../client/index.html'),
        function (err, data) {
          if (err) {
            res.writeHead(500)
            return res.end('Error loading index.html')
          }

          res.writeHead(200)
          res.end(data)
        })
      break;
    case '/main.js':
      fs.readFile(path.join(__dirname, '../client/main.js'),
        function (err, data) {
          if (err) {
            res.writeHead(500)
            return res.end('Error loading main.js')
          }

          res.writeHead(200)
          res.end(data)
        })
      break;
    case '/socket.io.js':
      fs.readFile(path.join(__dirname, '../../node_modules/socket.io-client/socket.io.js'),
        function (err, data) {
          if (err) {
            res.writeHead(500)
            return res.end('Error loading socket.io.js')
          }

          res.writeHead(200)
          res.end(data)
        })
      break;
    default:
      res.writeHead(500)
      return res.end('')
  }
}

const waitForEntities = ({ cartId, customerId, customerApiToken, postalCode }) => {
  if (cartId && customerId && customerApiToken && postalCode) {
    return ['cart', 'summary', 'customer', 'freightMenu']
  } else if (cartId && customerId && customerApiToken) {
    return ['cart', 'summary', 'customer']
  } else if (cartId) {
    return ['cart', 'summary']
  } else {
    return []
  }
}

const contains = (el, array) =>
  array.indexOf(el) >= 0

const notifyWaitFor = (socket, query) => {
  const entities = waitForEntities(query)
  socket.emit('wait-for', entities)
  return query
}

const getAll = socket => async data => {
  const { cartId, customerId, customerApiToken, postalCode } = data

  const entities = waitForEntities(data)

  const cart = axios
    .get(`https://sacola.submarino.com.br/api/v3/cart/${cartId}`)
    .then(c => c.data)

  const customer = axios
    .get(`https://sacola.submarino.com.br/api/v5/customer/${customerId}?token=${customerApiToken}`)
    .then(c => c.data)

  const freightMenu = Promise.all([cart, customer])
    .then(() => wait(1500))
    .then(() => 12345678)

  if (contains('cart', entities)) {
    cart
      .then(cart => socket.emit('data', { cart }))
      .catch(e => socket.emit('query-error', { cart: e }))
  }

  if (contains('customer', entities)) {
    customer
      .then(customer => socket.emit('data', { customer }))
      .catch(e => socket.emit('query-error', { customer: e }))
  }

  if (contains('freightMenu', entities)) {
    freightMenu
      .then(f => socket.emit('data', { freightMenu: { id: f } }))
      .catch(e => socket.emit('query-error', { freightMenu: e }))
  }

  if (contains('summary', entities)) {
    (async () => {
      try {
        const c = await cart
        const f = contains('freightMenu', entities) ? await freightMenu : undefined
        const summary = { type: f ? 'complete' : 'without freight' }
        socket.emit('data', { summary })
      } catch (e) {
        socket.emit('query-error', { summary: e })
      }
    })()
  }
}

const changeQuantity = async (socket, data) => {
  const { query: { cartId }, lineId, quantity } = data

  try {
    await axios.post(`https://sacola.submarino.com.br/api/v3/cart/${cartId}/line/${lineId}`, { quantity })
  } catch (e) {
    socket.emit('action-error', { cart: e })
  }

  return data.query
}

io.on('connection', function (socket) {
  socket.on('query', query => {
    notifyWaitFor(socket, query)
    return getAll(socket)(query)
  })

  socket.on('action', data => {
    console.log('Action:', data)

    switch (data.type) {
      case 'change-quantity':
        notifyWaitFor(socket, data.query)
        changeQuantity(socket, data)
          .then(getAll(socket))
        break
      default:
        break
    }
  })
})
