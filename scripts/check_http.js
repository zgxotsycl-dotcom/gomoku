const http = require('http');
const url = process.argv[2] || 'http://localhost:3000/ko';
http.get(url, (res) => {
  let data='';
  res.on('data', (c)=> data+=c.toString());
  res.on('end', ()=>{
    console.log('STATUS', res.statusCode);
    console.log(data.slice(0, 1200));
  });
}).on('error', (err)=>{
  console.error('HTTP_ERROR', err.message);
});

