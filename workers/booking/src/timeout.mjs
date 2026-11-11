export async function bounded(promise, ms, stage) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('Operation timed out'), { name: 'TimeoutError', stage })), ms);
    })]);
  } finally { clearTimeout(timer); }
}
