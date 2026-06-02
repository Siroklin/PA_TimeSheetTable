import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto('http://localhost:5173');
await page.waitForTimeout(2000);

await page.screenshot({ path: '/tmp/schedule-full.png', fullPage: true });
console.log('Screenshot saved');

const headerText = await page.textContent('.app-header h1').catch(() => 'NOT FOUND');
console.log('Header:', headerText);

const workshopOptions = await page.$$eval('select', selects => selects.map(s => ({
  options: Array.from(s.options).map(o => o.text),
  value: s.value
})));
console.log('Selects:', JSON.stringify(workshopOptions));

const dateInputs = await page.$$eval('input[type="date"]', inputs => inputs.map(i => i.value));
console.log('Date inputs:', JSON.stringify(dateInputs));

const nightCellBg = await page.$$eval('.cell-night', cells => {
  const first = cells[0];
  return first ? window.getComputedStyle(first).backgroundColor : 'none';
});
console.log('Night cell background:', nightCellBg);

const legendItems = await page.$$eval('.legend-item', items => items.map(i => i.textContent.trim()));
console.log('Legend:', JSON.stringify(legendItems));

const employeeNames = await page.$$eval('tbody .col-name', tds => tds.map(td => td.textContent.trim()));
console.log('Employees:', JSON.stringify(employeeNames));

await browser.close();
