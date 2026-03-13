from flask import render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db
import re


def validate_password(password):
    """
    Validate password requirements:
    - Minimum 8 characters
    - At least 1 uppercase letter
    - At least 1 lowercase letter
    - At least 1 number
    - At least 1 special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number."
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character."
    return True, ""


def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        # Validate password
        is_valid, error_msg = validate_password(password)
        if not is_valid:
            flash(error_msg, 'error')
            return render_template('signup.html')

        conn = get_db()
        c = conn.cursor()

        # Check if username already exists
        c.execute('SELECT id FROM users WHERE username = ?', (username,))
        if c.fetchone():
            conn.close()
            flash('Username not available.', 'error')
            return render_template('signup.html')

        # Check if email already exists (though not required, but good practice)
        c.execute('SELECT id FROM users WHERE email = ?', (email,))
        if c.fetchone():
            conn.close()
            flash('Email already registered.', 'error')
            return render_template('signup.html')

        # Hash the password
        hashed_password = generate_password_hash(password)

        # Insert new user
        c.execute(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            (username, email, hashed_password)
        )

        conn.commit()
        conn.close()

        flash('Signup successful! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('signup.html')


def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        conn = get_db()
        c = conn.cursor()

        c.execute(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            (username, username)
        )

        user = c.fetchone()
        conn.close()

        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']

            flash('Login successful!', 'success')
            return redirect(url_for('serve_home'))

        else:
            flash('Invalid username or password.', 'error')
            return render_template('login.html')

    return render_template('login.html')


def logout():
    session.clear()
    flash('Logged out successfully.', 'success')
    return redirect(url_for('login'))


def forgot_password():
    # Render the forgot/reset password page
    return render_template('forgot_reset_password.html')


def reset_password():
    if request.method == 'POST':
        email = request.form['email']
        new_password = request.form['new_password']

        # Validate new password
        is_valid, error_msg = validate_password(new_password)
        if not is_valid:
            flash(error_msg, 'error')
            return render_template('forgot_reset_password.html')

        conn = get_db()
        c = conn.cursor()

        # Check if email exists
        c.execute('SELECT id FROM users WHERE email = ?', (email,))
        user = c.fetchone()

        if not user:
            conn.close()
            flash('Email not found.', 'error')
            return render_template('forgot_reset_password.html')

        # Hash the new password
        hashed_password = generate_password_hash(new_password)

        # Update the password
        c.execute(
            'UPDATE users SET password = ? WHERE email = ?',
            (hashed_password, email)
        )

        conn.commit()
        conn.close()

        flash('Password updated successfully.', 'success')
        return redirect(url_for('login'))

    return render_template('forgot_reset_password.html')