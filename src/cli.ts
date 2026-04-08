const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: agent [agent-name] <message>');
  console.log('       a [agent-name] <message>');
  process.exit(0);
}

console.log('agent-cli: not yet implemented');
