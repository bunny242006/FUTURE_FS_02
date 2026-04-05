const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')

const app = express()

app.use(cors())
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: process.env.MYSQLHOST || '127.0.0.1',
    user: process.env.MYSQLUSER || "root",
    password: process.env.MYSQLPASSWORD || "mukesh",
    database: process.env.MYSQLDATABASE || "crm",
    port: process.env.MYSQLPORT || 3306
})

db.connect(err => {
    if (err) throw err
    console.log("MySQL Connected")
})

/* ✅ DATABASE LOGIN */
app.post('/login', (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).send({ success: false, message: 'Missing username/password' })
    }

    db.query(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username, password],
        (err, result) => {
            if (err) return res.status(500).send({ success: false, message: "Server error" })
            
            if (result.length > 0) {
                const user = result[0];
                if (user.status === 'Inactive') {
                    // Log failed attempt due to inactivity
                    db.query("INSERT INTO login_history (username, status) VALUES (?, ?)", [username, 'Blocked (Inactive)']);
                    return res.send({ success: false, message: "Account is inactive." })
                }
                
                // Log successful login
                db.query("INSERT INTO login_history (username, status) VALUES (?, ?)", [username, 'Success']);
                return res.send({ success: true, role: user.role })
            } else {
                // Log failed invalid attempt
                db.query("INSERT INTO login_history (username, status) VALUES (?, ?)", [username, 'Failed (Invalid)']);
                return res.send({ success: false, message: "Invalid credentials" })
            }
        }
    )
})

/* ✅ GET CUSTOMERS */
app.get('/customers', (req, res) => {
    db.query("SELECT * FROM customers ORDER BY created_at DESC", (err, result) => {
        if (err) {
            console.error(err)
            return res.status(500).send("Error fetching customers")
        }
        res.send(result)
    })
})

/* ✅ ADD CUSTOMER */
app.post('/addCustomer', (req, res) => {
    const { name, email, phone, company, value, status, source, due_date } = req.body

    const leadValue = value || 0.00;
    const leadStatus = status || 'New';
    const leadSource = source || 'Website';
    const leadDueDate = due_date || null; // NEW: due_date handling

    db.query(
        "INSERT INTO customers (name, email, phone, company, value, status, source, due_date) VALUES (?,?,?,?,?,?,?,?)",
        [name, email, phone, company, leadValue, leadStatus, leadSource, leadDueDate],
        (err) => {
            if (err) {
                console.error(err)
                return res.status(500).send("Error adding customer")
            }
            res.send("Added")
        }
    )
})

/* ✅ DELETE CUSTOMER */
app.delete('/delete/:id', (req, res) => {
    db.query(
        "DELETE FROM customers WHERE id=?",
        [req.params.id],
        (err) => {
            if (err) {
                console.error(err)
                return res.status(500).send("Error deleting customer")
            }
            res.send("Deleted")
        }
    )
})

/* ✅ CALENDAR NOTES */
app.get('/notes', (req, res) => {
    db.query("SELECT * FROM calendar_notes", (err, result) => {
        if (err) {
            console.error(err)
            return res.status(500).send("Error fetching notes")
        }
        res.send(result)
    })
})

app.post('/saveNote', (req, res) => {
    const { id_date, content } = req.body
    db.query(
        "INSERT INTO calendar_notes (id_date, content) VALUES (?, ?) ON DUPLICATE KEY UPDATE content = ?",
        [id_date, content, content],
        (err) => {
            if (err) return res.status(500).send("Error saving note")
            res.send("Saved")
        }
    )
})

/* ✅ SETTINGS & ADMIN */
app.get('/loginHistory', (req, res) => {
    db.query("SELECT * FROM login_history ORDER BY login_time DESC LIMIT 50", (err, result) => {
        if (err) return res.status(500).send("Error fetching history")
        res.send(result)
    })
})

app.get('/users', (req, res) => {
    db.query("SELECT id, username, role, status FROM users", (err, result) => {
        if (err) return res.status(500).send("Error fetching users")
        res.send(result)
    })
})

app.post('/addUser', (req, res) => {
    const { username, password, role, status } = req.body
    db.query(
        "INSERT INTO users (username, password, role, status) VALUES (?, ?, ?, ?)",
        [username, password, role || 'User', status || 'Active'],
        (err) => {
            if (err) return res.status(500).send("Error adding user")
            res.send("Added")
        }
    )
})

app.post('/updateUserStatus', (req, res) => {
    const { id, status } = req.body
    db.query("UPDATE users SET status = ? WHERE id = ?", [status, id], (err) => {
        if (err) return res.status(500).send("Error updating status")
        res.send("Updated")
    })
})

app.listen(3000, () => {
    console.log("Server running on port 3000")
})
