import { TakaoImpl } from '../src/TakaoImpl';

async function testSave() {
  console.log('Starting Takao engine...');

  const takao = new TakaoImpl();
  await takao.initialize();
  console.log('Takao initialized');

  takao.start();
  console.log('Started engine');

  // Run for 2 turns then stop
  setTimeout(() => {
    console.log('Stopping engine...');
    takao.stop();
  }, 3000);
}

testSave().catch(console.error);
