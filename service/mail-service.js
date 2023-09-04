const nodeMailer = require('nodemailer');
require('dotenv').config();

class MailService {

    constructor() {
        this.transporter = nodeMailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            }
        })
    }

    // async sendActivationMail(to, link) {
    //     await this.transporter.sendMail({
    //         from: process.env.SMTP_USER,
    //         to,
    //         subject: `Активация аккаунта `,
    //         html:
    //         `
    //             <div>
    //                 <h1>Для активации аккаунта перейдите по ссылке:</h1>
    //                 <a href="${link}">${link}</a>
    //             </div>
    //         `
    //     })
    // }

    async sendActivationMail(to, link) {
        await this.transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject: `Memorizer account activation `,
            html:
            `
                <div>
                    <h1>To activate your account at Memorizer please click on the link below:</h1>
                    <a href="${link}">${link}</a>
                </div>
            `
        })
    }
}

module.exports = new MailService();