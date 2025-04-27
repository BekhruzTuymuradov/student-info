const fs = require('fs')
const XLSX = require('xlsx')
const students = require('./collect_data.js')

// Read the Excel file
const workbook = XLSX.readFile('students.xlsx')
const worksheet = workbook.Sheets[workbook.SheetNames[0]]
const excelData = XLSX.utils.sheet_to_json(worksheet)

// Create a map of student IDs to their faculty and group number
const excelStudents = new Map()
excelData.forEach(row => {
	if (row.ID) {
		const groupParts = row['Group Number'] ? row['Group Number'].split('-') : []
		const groupNumber = groupParts.length > 1 ? groupParts[1] : ''
		excelStudents.set(row.ID.toUpperCase(), {
			faculty: row.Faculty || '',
			groupNumber: groupNumber,
		})
	}
})

// Track matched and unmatched students (split by year)
const students_23 = []
const students_22 = []
const students_21 = []
const unmatchedStudents = []
const matchedIds = new Set()

students.forEach(student => {
	// Safely access properties with optional chaining
	const studentId = student.studentId || student.student_id || ''
	if (!studentId) {
		console.log('Found student with missing ID:', student)
		return
	}

	const cleanStudentId = studentId.trim().toUpperCase()
	const excelStudent = excelStudents.get(cleanStudentId)
	const studentYear = cleanStudentId.substring(1, 3) // Extract the year part (23, 22, or 21)

	const studentWithUpdates = excelStudent
		? {
				...student,
				studentFaculty: excelStudent.faculty,
				studentGroupNumber: excelStudent.groupNumber,
		  }
		: student

	if (excelStudent) {
		matchedIds.add(cleanStudentId)
	} else {
		unmatchedStudents.push(student)
	}

	// Sort into appropriate year array
	if (studentYear === '23') {
		students_23.push(studentWithUpdates)
	} else if (studentYear === '22') {
		students_22.push(studentWithUpdates)
	} else if (studentYear === '21') {
		students_21.push(studentWithUpdates)
	}
})

// Find students in Excel but not in student_info.js
const unmatchedInExcel = []
excelStudents.forEach((value, key) => {
	if (!matchedIds.has(key)) {
		unmatchedInExcel.push({
			studentId: key,
			faculty: value.faculty,
			groupNumber: value.groupNumber,
		})
	}
})

// Sort function that first sorts by team number, then puts team leader first, then other members alphabetically
function sortByTeamLeaderAndName(a, b) {
	// Get team number safely
	const teamNumA =
		a.team_number || parseInt((a.team || '').replace(/\D/g, '')) || 0
	const teamNumB =
		b.team_number || parseInt((b.team || '').replace(/\D/g, '')) || 0

	// First compare by team number
	if (teamNumA !== teamNumB) {
		return teamNumA - teamNumB
	}

	// If teams are the same, check if either is a team leader
	const roleA = (a.role || '').toUpperCase()
	const roleB = (b.role || '').toUpperCase()

	// Team leader comes first
	if (roleA === 'TEAM LEADER' && roleB !== 'TEAM LEADER') {
		return -1
	}
	if (roleB === 'TEAM LEADER' && roleA !== 'TEAM LEADER') {
		return 1
	}

	// If both are team leaders or both are members, sort alphabetically by name
	const nameA = (a.student_name || '').toUpperCase()
	const nameB = (b.student_name || '').toUpperCase()
	if (nameA < nameB) return -1
	if (nameA > nameB) return 1
	return 0
}

// Apply the sorting
students_23.sort(sortByTeamLeaderAndName)
students_22.sort(sortByTeamLeaderAndName)
students_21.sort(sortByTeamLeaderAndName)
unmatchedStudents.sort(sortByTeamLeaderAndName)
unmatchedInExcel.sort((a, b) => a.studentId.localeCompare(b.studentId))

// Write the updated student data split by year
fs.writeFileSync(
	'student_info_updated.js',
	`const students_23 = ${JSON.stringify(students_23, null, 2)};\n` +
		`const students_22 = ${JSON.stringify(students_22, null, 2)};\n` +
		`const students_21 = ${JSON.stringify(students_21, null, 2)};\n\n` +
		`module.exports = {\n` +
		`    students_23,\n` +
		`    students_22,\n` +
		`    students_21\n` +
		`};`
)

// Write unmatched students
fs.writeFileSync(
	'unmatched_students.json',
	JSON.stringify(
		{
			notFoundInExcel: unmatchedStudents,
			notFoundInStudentInfo: unmatchedInExcel,
		},
		null,
		2
	)
)

console.log(`=== Processing Results ===`)
console.log(`Total students in database: ${students.length}`)
console.log(
	`Matched students: ${
		students_23.length + students_22.length + students_21.length
	}`
)
console.log(`- U23 students: ${students_23.length}`)
console.log(`- U22 students: ${students_22.length}`)
console.log(`- U21 students: ${students_21.length}`)
console.log(
	`Unmatched students (in student_info.js but not in Excel): ${unmatchedStudents.length}`
)
console.log(
	`Unmatched students (in Excel but not in student_info.js): ${unmatchedInExcel.length}`
)
console.log('\nGenerated files:')
console.log(
	'- student_info_updated.js: Updated student data split by year (U23, U22, U21)'
)
console.log(
	'- unmatched_students.json: Contains both types of unmatched students'
)
