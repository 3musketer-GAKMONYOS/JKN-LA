import fetch from 'node-fetch';

async function run() {
  const res = await fetch('http://localhost:3000/api/master-rekening');
  const data = await res.json();
  const res2 = data.filter(r => r.kodeRekening.includes('.5.1.01'));
  console.log(JSON.stringify(res2, null, 2));
}
run();
