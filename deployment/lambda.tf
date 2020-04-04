variable "smtp_username" {
  type = string
}
variable "smtp_password" {
  type = string
}

provider "aws" {
  region = "eu-west-1"
}

resource "aws_lambda_permission" "GPCovidResponse-Invite" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = "${aws_lambda_function.GPCovidResponse-Invite.function_name}"
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_function" "GPCovidResponse-Invite" {
  filename      = "../artifact/covid-backend.zip"
  function_name = "GPCovidResponse-Invite"
  role          = "arn:aws:iam::368263227121:role/service-role/GPCovidResponse-Documents-role-k8gh1hnc"
  handler       = "index.handler"
  source_code_hash = "${filebase64sha256("../artifact/covid-backend.zip")}"
  runtime       = "nodejs12.x"

  environment {
    variables = {
      SMTP_USERNAME = var.smtp_username,
      SMTP_PASSWORD = var.smtp_password
    }
  }

}
