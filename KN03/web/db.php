<?php
$host = "kn02b-db";
$username = "root";
$password = "root1234";
$db = "mydb";

$conn = mysqli_connect($host, $username, $password, $db);

if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}

echo "Connected successfully to database: " . $db;
?>
