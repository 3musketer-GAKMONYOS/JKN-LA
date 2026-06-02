async function test() {
  try {
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: JSON.stringify({username:"t",password:"t"}),
      headers: { "Content-Type": "application/json"}
    });
    const text = await res.text();
    console.log("STATUS:", res.status);
    console.log("BODY:", text);
  } catch (e) { console.error(e); }
}
test();
