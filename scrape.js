const puppeteer = require('puppeteer')
const fs = require('fs')

;(async () => {
	const browser = await puppeteer.launch({ headless: false })
	const page = await browser.newPage()

	await page.goto('https://eclass.inha.ac.kr/login/index.php', {
		waitUntil: 'networkidle2',
	})

	console.log(
		'Please log in manually. After logging in, press Enter here to continue...'
	)

	await new Promise(resolve => {
		process.stdin.once('data', () => {
			resolve()
		})
	})

	await page.goto('https://eclass.inha.ac.kr/mod/page/index.php?id=1969', {
		waitUntil: 'networkidle2',
	})

	const result = await page.evaluate(() => {
		const data = []
		console.log('Starting data extraction...')

		// Find the link with the text containing "ASSIGNMENT4 APPROVED TEAM LIST"
		const targetLink = Array.from(document.querySelectorAll('a')).find(a =>
			a.textContent.includes('LAB ASSIGNMENT4 APPROVED TEAM LIST')
		)

		if (!targetLink) {
			console.log('Could not find the target link')
			return data
		}

		console.log('Found target link:', targetLink.textContent)

		// Navigate to the parent cell that contains the content
		const parentCell = targetLink.closest('td').nextElementSibling

		if (!parentCell || !parentCell.classList.contains('cell')) {
			console.log('Could not find the parent cell with content')
			return data
		}

		console.log('Found content cell')

		let currentTeamNumber = null
		let inStudentRows = false
		let headerRow = null

		// Find all tables in the cell
		const tables = parentCell.querySelectorAll('table')

		// We're particularly interested in the table that contains the team data
		tables.forEach((table, tableIndex) => {
			const rows = table.querySelectorAll('tr')

			rows.forEach((row, rowIndex) => {
				const cells = row.querySelectorAll('td')
				if (cells.length === 0) return

				// Check if this is a team header row
				const teamCell = Array.from(cells).find(cell => {
					const text = cell.textContent.trim()
					return text.match(/^TEAM\s+\d+$/i)
				})

				if (teamCell) {
					const teamMatch = teamCell.textContent.trim().match(/^TEAM\s+(\d+)$/i)
					if (teamMatch) {
						currentTeamNumber = parseInt(teamMatch[1], 10)
						console.log(`Found Team ${currentTeamNumber}`)
						inStudentRows = false // Reset, we'll set it to true after finding header row
					}
				}

				// Check if this is the header row (column names)
				const slNoCell = Array.from(cells).find(cell => {
					const text = cell.textContent.trim()
					return text === 'SL. NO.'
				})

				if (slNoCell && cells.length >= 6) {
					headerRow = row
					inStudentRows = true
					console.log('Found header row')
				}

				// If we have a team number and we're in student rows section, check if this is a student row
				if (currentTeamNumber && inStudentRows && cells.length >= 6) {
					// Skip the header row itself
					if (row === headerRow) return

					const slNo = cells[0].textContent.trim()
					// Check if the first cell has a number
					if (/^\d+$/.test(slNo)) {
						const studentId = cells[2].textContent.trim()

						// Check if this is a student ID format (starts with U followed by digits)
						if (studentId.match(/^U\d+$/)) {
							console.log(
								`Found student: ${cells[1].textContent.trim()} (${studentId})`
							)

							data.push({
								team: `TEAM ${currentTeamNumber}`,
								team_number: currentTeamNumber,
								sl_no: slNo,
								student_name: cells[1].textContent.trim(),
								student_id: studentId,
								section_no: cells[3].textContent.trim(),
								email_address: cells[4].textContent.trim(),
								role: cells[5].textContent.trim(),
							})
						}
					}
				}
			})
		})

		return data
	})

	console.log('Collected students:', result.length)

	// Log the first few entries to verify data structure
	console.log('Sample of collected data:')
	console.log(JSON.stringify(result.slice(0, 3), null, 2))

	// Remove duplicates: keep unique student_id
	const uniqueResult = Array.from(
		new Map(result.map(item => [item.student_id, item])).values()
	)

	console.log(
		'Collected students after removing duplicates:',
		uniqueResult.length
	)

	fs.writeFileSync(
		'collect_data.js',
		'module.exports = ' + JSON.stringify(uniqueResult, null, 2)
	)

	console.log('✅ Data saved to collect_data.js successfully!')

	await browser.close()
})()
