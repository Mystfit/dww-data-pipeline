#!/usr/bin/env python

import sys
import re
import resource
import pdb
import os
import gc
import cPickle as pickle
import time
import shutil


reload(sys)
sys.setdefaultencoding("utf-8")

# Import the IMDbPY package.
try:
    import imdb
    from py2neo import neo4j, node, rel
    from fuzzywuzzy import fuzz

except ImportError:
    print('Missing neo4j or imdbpy or fuzzywuzzy')
    sys.exit(1)

class ImdbScraper:

    def __init__(self):
        # IMDB interface
        self.i = imdb.IMDb()
        self.cachedCompanySearches = {}

        # Neo4j interface
        self.graph_db = neo4j.GraphDatabaseService(
            "http://localhost:7474/db/data/")

    def SetRootCompany(self, companyID, companySearchTag):
        self.companyID = companyID
        self.companySearchTag = companySearchTag
        self.rootCompany = self.i.get_company(self.companyID)
        print("Searching IMDB for employees of '" +
              str(self.rootCompany['name']) + "':")

        # List of companies for quick checking for existing companies
        self.companyList = [self.rootCompany]

    def GetPeopleInFilmography(self, filmographyDepth):
        personList = {}

        self.companyIndex = self.graph_db.get_or_create_index(
            neo4j.Node, "company")
        self.movieIndex = self.graph_db.get_or_create_index(
            neo4j.Node, "movie")
        self.personIndex = self.graph_db.get_or_create_index(
            neo4j.Node, "person")

        companyNode = self.FindOrCreateCompanyNode(self.rootCompany)

        # Dummy movie list of first n movies
        movieList = []

        if(filmographyDepth < 0):
            filmographyDepth = len(
                self.rootCompany['special effects companies'])

        for i in range(filmographyDepth):
            movieList.append(self.rootCompany['special effects companies'][i])

        for movie in movieList:
            movDB = self.GetCachedListAndNode(movie, "visual effects", "movie")
            movNode = movDB[0]
            vfxCrew = movDB[1]

            if(vfxCrew):
                movCompanyRelationship = list(
                    self.graph_db.match(start_node=companyNode, end_node=movNode))
                if(len(movCompanyRelationship) < 1):
                    self.graph_db.create(rel(companyNode, "FILMOGRAPHY", movNode))

                for person in vfxCrew:
                    vfxRole = self.FindCompanyFromPersonNotes(
                        person, self.companySearchTag)
                    if(len(vfxRole.matchedTag) > 0):
                        personList[person.getID()] = person
                print("--- '" + movNode.get_properties()['name'] + "'. Scanned " + str(len(vfxCrew)) + " people. Total found: " + str(len(personList)))
           
        print("--- Total unique employees found: " + str(len(personList)) )
        print '!!! Memory usage: %s (mb)' % str(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1000000)
        return personList

    def ConnectPeopleToCompanies(self, personList):
        print("---------------------------------")
        self.ResetRelationships()

        self.personCount = 0
        self.personTotal = len(personList)

        print("Searching employee filmographies")
        for personID, person in personList.iteritems():
            startmem = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1000000

            personDB = self.GetCachedListAndNode(person, "visual effects", "person")
            personNode = personDB[0]
            personFilmography = personDB[1]

            if len(personFilmography) < 1:
                print(" === " + str(person['name']) + " has no VFX filmography.")
                print(person)
                print(" === Skipping...")
                continue

            for movie in personFilmography:
                movDB = self.GetCachedListAndNode(movie, "visual effects", "movie")
                movNode = movDB[0]
                vfxCrew = movDB[1]

                personInMovie = self.FindPersonInList(vfxCrew, personNode)
                if(personInMovie):
                    vfxRole = self.FindCompanyFromPersonNotes(personInMovie)
                    existingCompany = None
                    if vfxRole.company in self.cachedCompanySearches:
                        existingCompany = self.cachedCompanySearches[vfxRole.company]
                        print("Found cached company " + str(vfxRole.company))

                    if not existingCompany:
                        if(len(vfxRole.company) > 0):
                            print("Searching for '" + str(vfxRole.company) + "'")
                            while True:
                                try:
                                    companyList = self.i.search_company(vfxRole.company)
                                except imdb.IMDbDataAccessError:
                                    print("*** HTTP error. Redialling")
                                    continue
                                break
                            if(len(companyList) > 0):
                                # Grab first company only
                                existingCompany = companyList[0]
                                self.cachedCompanySearches[vfxRole.company] = existingCompany
                                if len(existingCompany) > 0:
                                    print("Found " + str(existingCompany['name']))

                    if existingCompany:
                        print("Attach '" + str(personInMovie['name']) + "' to '" + str(
                            existingCompany['name']) + "' for '" + str(vfxRole.role) + "'")
                        companyNode = self.FindOrCreateCompanyNode(existingCompany)
                        self.ConnectPersonToCompany(
                            personNode, companyNode, vfxRole, movNode)
                    else:
                        print("No company for '" + str(person['name']) + "' under role '" + str(vfxRole.role) + "'")
                else:
                    print("Couldn't find person in movie")
            
            self.personCount += 1
            print(" === " + str(self.personCount) + "/" + str(self.personTotal) + " people processed")
            print('!!! Delta Memory usage: %s (mb)' % str(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1000000 - startmem))
            print('!!! Total Memory usage: %s (mb)' % str(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1000000))
            
        print('===== Finished =====')

    def ConnectPersonToCompany(self, personNode, companyNode, vfxrole, movieNode):
        personCompanyRelationship = list(
            self.graph_db.match(start_node=personNode, end_node=companyNode))

        # Use fuzzy matching to see if we need to flag this relationship as one to check the company
        fuzzyCompanyMatch = fuzz.ratio(companyNode.get_properties()['name'].lower().strip(), vfxrole.company.lower().strip())

        relExists = False
        # Check for preexisting relationships to company
        for personRel in personCompanyRelationship:
            if(personRel.get_properties()["movieID"] == movieNode.get_properties()['id']):
                relExists = True

        if not relExists:
            roleNode, =  self.graph_db.create(
                rel(personNode, "WORKED_FOR", companyNode))
            roleNode.update_properties(
                {'role': vfxrole.role, 'company': vfxrole.company, 'movieID': movieNode.get_properties()['id'], 'release': movieNode.get_properties()['release'], 'matchRatio': fuzzyCompanyMatch})
        if not silent:
            print("Match ratio: " + str(fuzzyCompanyMatch) + ". CompRole: " + str(vfxrole.company.lower().strip()) + ". Node: " + str(companyNode.get_properties()['name'].lower().strip()) )

    def GetCachedListAndNode(self, imdbObj, listKey, nodeType):
        cachedList = None
        cachedListPickle = None
        pickleFileName = str(imdbCacheDir + "/" + nodeType + "/" + str(imdbObj.getID()) + ".pkl")
        cachedNode = self.graph_db.get_indexed_node(
            nodeType, "id", imdbObj.getID())

        if not cachedNode:
            self.UpdateImdbObj(imdbObj)
            if imdbObj.has_key(listKey):

                # Save key list into pickle file
                cachedList = imdbObj[listKey]
                pickleFile = open( pickleFileName, 'wb')
                cachedListPickle = pickle.dump(cachedList, pickleFile)
                pickleFile.close()

                # Build DB node
                cachedNode, = self.graph_db.create(node(id=str(imdbObj.getID())))
                cachedNode.add_labels(nodeType)

                # Set node properties
                nodeProperties = {}
                nodeIndex = None

                if nodeType == "movie":
                    year = ""
                    if imdbObj.has_key('year'):
                        year = imdbObj['year']
                    nodeProperties['release'] = year
                    nodeProperties['name'] = imdbObj['title']
                    nodeIndex = self.movieIndex
                elif nodeType == "person":
                    nodeProperties['name'] = imdbObj['name']
                    nodeIndex = self.personIndex
                elif nodeType == "company":
                    nodeProperties['name'] = imdbObj['name']
                    nodeIndex = self.companyIndex

                cachedNode.update_properties(nodeProperties)
                nodeIndex.add("id", cachedNode['id'], cachedNode)

                print("Finished caching " + str(nodeType) + " '" + str(nodeProperties['name']) + "'")
            else:
                print "No vfx credits found in film"
        else:
            try:
                with open(pickleFileName, 'rb'):
                    print("Loading " + str(nodeType) + " '" + str(imdbObj.getID()) + "' from cache")
                    pickleFile = open(pickleFileName, 'rb')
                    cachedList = pickle.load(pickleFile)
                    pickleFile.close()
            except IOError:
                print "No pickle found"

        return cachedNode, cachedList

    def UpdateImdbObj(self, imdbObj):
        while True:
            try:
                self.i.update(imdbObj)
            except imdb.IMDbDataAccessError:
                print("*** HTTP error. Redialing")
                continue
            break

    def FindOrCreateCompanyNode(self, imdbCompany):
        companyNode = self.graph_db.get_indexed_node(
            "company", "id", imdbCompany.getID())
        if not companyNode:
            if not silent:
                print("Couldn't find company node. Searched for '" +
                  str(imdbCompany['name']) + "'. Creating...")
            while True:
                try:
                    self.i.update(imdbCompany)
                except imdb.IMDbDataAccessError:
                    print("*** HTTP error. Redialling")
                    continue
                break
            companyNode, = self.graph_db.create(node(id=imdbCompany.getID()))
            companyNode.add_labels("company")
            companyNode.update_properties({'name': imdbCompany['name']})
            self.companyIndex.add("id", companyNode['id'], companyNode)

        return companyNode

    def FindCompanyFromPersonNotes(self, person, companyTag=""):
        outRole = VFXRole()
        filtered = re.sub('[!@#$\(\)\[\]]', '', person.notes).rstrip()        
        splitRole = []

        try:
            splitRole = filtered.split(": ")
        except:
            print("Something went wrong splitting roles")

        role = ""
        comp = ""
        if not silent:
            print(str("Finding company from notes: '" + str(filtered) + "'"))
        if(len(splitRole) > 1):
            role = str(splitRole[0])
            comp = str(splitRole[1]).lower()
            splitComp = comp.split(' - ')
            if(len(companyTag) > 0):
                if comp.find(self.companySearchTag) > -1:
                    outRole.matchedTag = companyTag
            outRole.role = role
            outRole.company = splitComp[0]
        else:
            outRole.role = role

        return outRole

    def FindPersonInList(self, crewList, personNode):
        for p in crewList:
            if p.getID() == personNode.get_properties()['id']:
                return p
        return None

    def FindCompanyInNodes(self, imdbCompany):
        for comp in self.companyList:
            if(comp['name'].lower() == imdbCompany['name'].lower()):
                return comp
        return None

    def ResetDb(self):
        print("Clearing nodes")
        query = neo4j.CypherQuery(self.graph_db, "start n = node(*) delete n")
        query.execute()

    def ResetRelationships(self):
        print("Clearing relationships")
        query = neo4j.CypherQuery(self.graph_db, "start r = relationship(*) delete r")
        query.execute()

    def ResetCache(self):
        cacheDirs = ["movie", "person", "company"]
        for cacheDir in cacheDirs:
            print "Clearing %s cache" % cacheDir
            os.chdir(imdbCacheDir + "/" + cacheDir)
            dirlist = [f for f in os.listdir(".") if f.endswith(".pkl") ]
            for f in dirlist:
                os.remove(f)
        
#
# Class for storing a role and associated company
#
class VFXRole:

    def __init__(self):
        self.role = ""
        self.company = ""
        self.matchedTag = ""


# Script start
# -----------------------------------------------------
scraper = ImdbScraper()


# Recurse limits
filmographyDepth = -1

#Cache locations
imdbCacheDir =  os.path.abspath("imdbCache")

# Hardcoded Weta company id
companyID = 5031
companySearchTag = 'weta'

# Logging
silent = True

# Start flags
if len(sys.argv) <= 1:
    print("Usage: python2 GetWeta.py (employees/connections/reset/reset_relationships)")

if len(sys.argv) > 1:
    print("Starting...")
    scraper.SetRootCompany(companyID, companySearchTag)

    if(sys.argv[1] == "reset"):
        scraper.ResetCache()
        scraper.ResetRelationships()
        scraper.ResetDb()
    elif(sys.argv[1] == "resetDB"):
        scraper.ResetRelationships()
        scraper.ResetDb()
    elif(sys.argv[1] == "employees"):
        print("Searching for employees in filmography...")
        scraper.GetPeopleInFilmography(filmographyDepth)
    elif(sys.argv[1] == "connections"):
        print("Searching for employees in filmography...")
        personList = scraper.GetPeopleInFilmography(filmographyDepth)
        scraper.ConnectPeopleToCompanies(personList)
    
