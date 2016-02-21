console.log('Loading app...')

const socket = io('http://localhost:5555');

socket.on('data', d => console.log(d))

socket.on('query-error', d => console.warn('Query Error', d))

socket.on('action-error', d => console.warn('Action Error', d))

socket.on('wait-for', w => console.log(`You have to wait for ${w}`))

socket.emit('query', {
  cartId: 'RQMv9QeIBFD8FWimPnNDTn2FyDO',
  customerId: '03-4902183514-1',
  customerApiToken: 'vqwd1lNuITyhKmsGbqeReVFU12_V0MEeV2GQZgCyjJH_cXpAPuY3g1MuBTVVyfud',
  postalCode: 12345678
})
