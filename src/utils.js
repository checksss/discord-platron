const countries_json = require('./countryCodes.json');
const { Collection } = require('discord.js');
const { ClientUtil } = require('discord-akairo');
const cheerio = require('cheerio');
const request = require('request-promise');
const winston = require('winston');

module.exports = class Utils extends ClientUtil {
    get countries() {
        const col = new Collection();

        for (const c in countries_json) {
            col.set(c, countries_json[c]);
        }

        return col;
    }

    objectToCollection(object) {
        const col = new Collection();
        for (const id in object) {
            col.set(id, object[id]);
        }
        return col;
    }

    getFlag(countryName) {
        const country = this.countries.find(c => {
            return c.countryName.toLowerCase() == countryName.toLowerCase();
        });

        if (country) {
            return `:flag_${country.iso2.toLowerCase()}:`;
        }

        return '';
    }

    number(number) {
        return Number(number).toLocaleString();
    }

    strToColor(str) {
        const hashCode = s => {
            let hash = 0;
            for (var i = 0; i < str.length; i++) {
                hash = s.charCodeAt(i) + ((hash << 5) - hash);
            }
            return hash;
        };

        const intToRGB = i => {
            var c = (i & 0x00FFFFFF).toString(16).toUpperCase();
            return '00000'.substring(0, 6 - c.length) + c;
        };

        if (!str || str == '') {
            return 'ffffff';
        }

        return intToRGB(hashCode(str)).toLowerCase().split('')
        .reduce((result, ch) => (result * 16) + '0123456789abcdefgh'.indexOf(ch), 0);
    }

    async getCitizenInfo(id) {
        const body = await request.get(`https://www.erepublik.com/en/citizen/profile/${id}`);
        const $ = cheerio.load(body);
        const data = {};
        const $ca = $('.citizen_activity').children();

        const prettify = text => {
            return String(text).replace(/[\t\n\r]/g, '').replace(/\s+/g, ' ').trim();
        };

        data.party = prettify($ca.first().find('.noborder span a').text());
        data.partyRole = prettify($ca.first().find('h3').text());

        return data;
    }

    async citizenNameToId(name) {
        const body = await request.get(`https://www.erepublik.com/en/main/search/?q=${encodeURIComponent(name)}`);
        const $ = cheerio.load(body);

        const results = $('table.bestof tr');

        if (results.length >= 2) {
            const profileUrl = $(results[1]).find('.nameholder a').attr('href');
            if (profileUrl) {
                const match = profileUrl.match(/profile\/([0-9]+)/);
                if (match) {
                    const id = Number(match[1]);

                    return id;
                }
            }
        }
    }

    get client() {
        return this.module.client;
    }

    async getCitizensInGuild(guild) {
        const Citizen = this.client.databases.citizens.table;
        const citizens = await Citizen.all();
        const filtered = new Collection();

        for (const i in citizens) {
            const citizen = citizens[i];

            if (guild.members.has(citizen.discord_id)) {
                filtered.set(citizen.id, {
                    citizen: citizen,
                    member: guild.members.get(citizen.discord_id)
                });
            }
        }

        return filtered;
    }

    async removeAllRoles(member, guild) {
        const Role = this.client.databases.roles.table;
        const roles = await Role.findAll({
            where: {
                guildId: guild.id
            }
        });

        const roleKeys = [];
        for (const i in roles) {
            roleKeys.push(roles[i].id);
        }

        await member.removeRoles(roleKeys);
    }

    async getRolesWithGroup(group) {
        const Role = this.client.databases.roles.table;
        const roles = await Role.findAll({
            where: {
                group: group
            }
        });

        return roles.map(role => {
            return role.id;
        });
    }

    async findOrCreateRole(roleName, roleGroup, guild, defaults) {
        const Role = this.client.databases.roles.table;
        const roleItem = await Role.findOne({
            where: {
                name: roleName,
                guildId: guild.id,
                group: roleGroup
            }
        });

        if (roleItem) {
            winston.verbose('Found role in db with name', roleName);

            if (guild.roles.has(roleItem.id)) {
                winston.verbose('Found role in the collection');
                return guild.roles.get(roleItem.id);
            } else {
                winston.warn('Role', roleItem.id, 'was not valid. Deleting from database');
                await roleItem.destroy();
            }
        }

        const createdRole = await guild.createRole(defaults);
        winston.info('Created role', createdRole.name, 'with id', createdRole.id);

        await Role.create({
            id: createdRole.id,
            name: roleName,
            guildId: guild.id,
            group: roleGroup,
            mentionable: true
        });
        winston.info('Role', createdRole.id, 'saved to database for guild', guild.id);
        return createdRole;
    }
};
