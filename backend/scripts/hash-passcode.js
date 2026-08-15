import bcrypt from 'bcryptjs';

const passcode = process.argv[2];

if (!passcode) {
  console.error('Please provide a passcode to hash: npm run hash-passcode <passcode>');
  process.exit(1);
}

const saltRounds = 10;
bcrypt.hash(passcode, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing passcode:', err);
    process.exit(1);
  }
  console.log('\n--- HASH GENERATED SUCCESSFULY ---');
  console.log('Passcode:', passcode);
  console.log('Hash to copy into your .env under APP_PASSCODE:');
  console.log(hash);
  console.log('---------------------------------\n');
});
