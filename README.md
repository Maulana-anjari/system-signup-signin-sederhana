#LEARN: API system-signup-signin-sederhana <br>
system signup-signin sederhana dengan node-express-mongo-heroku
<br>
Link = https://maulana-anjari-system-login.herokuapp.com/   -> only text welcome
<br>
<h3>Test on postman</h3>
<h4>Sign Up (Regristration)</h4>
<p>Link = https://maulana-anjari-system-login.herokuapp.com/user/signup</p>
<p>Example: </p>
<p>With real email it can send email verification to that email</p>
{
    "name":"Park Chaeyoung",
    "email":"rose@mail.yg.co.kr",
    "password":"rosearerossie",
    "dateOfBirth":"02-11-1997"
}
<h4>Sign In (Log In)</h4>
<p>Before sign in, the email must be verified by clicking link verification</p>
<p>Link = https://maulana-anjari-system-login.herokuapp.com/user/signin</p>
<p>Example:</p>
{
    "email":"rose@mail.yg.co.kr",
    "password":"rosearerossie"
}
