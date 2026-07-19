export function isApply(options) {
  return options.apply === true && options['dry-run'] !== true;
}

export function output(data, options, fallbackFormatter) {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (fallbackFormatter) {
    fallbackFormatter(data);
  } else {
    console.log(data);
  }
}
